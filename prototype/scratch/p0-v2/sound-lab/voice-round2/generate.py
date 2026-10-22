"""Round 2: one Zi-bloo identity at three degrees of articulation.

A uses the installed eSpeak NG formant synthesizer (synchronous, no playback).
B/C are original additive/formant synthesis. No model downloads or remote services.
"""
from pathlib import Path
import ctypes as c
import importlib.util
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 44100
TAU = 2*np.pi
RNG = np.random.default_rng(20261022)
EVENTS = [
    ('greet', '招牌叫声', '轻轻叫出自己的名字，像抬头和你打招呼。'),
    ('work', '开始工作', '短一些、向上走：准备好，开始吧。'),
    ('rest', '进入休息', '放慢一点、向下落：松一口气。'),
    ('complete', '全部完成', '完整展开名字，带着为你开心的语气。'),
    ('reminder', '日常提醒', '先轻轻叫一下，停顿后再呼唤。'),
]
VOICES = [
    ('clear', 'A', '清楚叫名字', 'Zi—bloo', '把 Zi 与 bloo 的辅音、元音说清楚，直接建立名字记忆。', '名字最明确 · 机械发音感较强', '#557e78'),
    ('creature', 'B', '隐约像名字', 'zi～bluu', '让名字融进圆润的小叫声里，保留一点含糊和柔软。', '名字与生物感之间', '#4d8f85'),
    ('motif', 'C', '只保留韵律', '短 · 长', '把辅音藏起来，留下短起音、长尾音和滑动的呼唤。', '更抽象 · 更接近日常提示', '#8c946a'),
]


def fade(x, attack=.01, release=.035):
    x=x.copy()
    a=min(int(attack*SR),len(x)//2); r=min(int(release*SR),len(x)//2)
    if a: x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
    if r: x[-r:]*=np.cos(np.linspace(0,np.pi/2,r))**2
    return x


def silence(seconds): return np.zeros(round(SR*seconds))


def band_noise(length, center=3300, width=1400):
    x=RNG.normal(size=length)
    bins=np.fft.rfftfreq(length,1/SR)
    y=np.fft.irfft(np.fft.rfft(x)*np.exp(-((bins-center)/width)**2),n=length)
    return y/(np.sqrt(np.mean(y*y))+1e-9)


def voiced(vowel, dur, freq, end_ratio=1, breath=.008, soft=False):
    t=np.arange(round(dur*SR))/SR; u=t/dur
    f=freq*np.exp(np.log(end_ratio)*u)*(1+.006*np.sin(TAU*4.6*t))
    phase=TAU*np.cumsum(f)/SR
    if vowel=='i':
        formants=[(340+70*u,130),(2150-200*u,480),(3000,650)]
    elif vowel=='l':
        formants=[(420,150),(1000-250*u,240),(2300,550)]
    else:
        formants=[(420-90*u,180),(1000-270*u,300),(2200,600)]
    x=np.zeros_like(t)
    for h in range(1,28):
        hz=h*f
        weight=sum(amp*np.exp(-((hz-center)/width)**2)
                   for (center,width),amp in zip(formants,[1,.40,.13]))
        weight+=.10/(h**.8)
        x+=np.sin(h*phase)*weight/(h**(.65 if not soft else 1.05))
    envelope=np.sin(np.pi*np.clip(u,.00001,.99999))**.55
    envelope*=1-.12*u
    x=x*envelope+breath*band_noise(len(t),1500,900)*envelope
    return fade(x,.016,.05)


def creature_pair(event, abstract=False):
    # The same short Zi + rounded longer bloo skeleton across all emotional states.
    config={
        'greet':(310,.17,.38,1.13,.83,.035),
        'work':(330,.12,.25,1.0,1.24,.025),
        'rest':(255,.15,.53,.96,.72,.05),
        'complete':(315,.17,.48,1.08,1.13,.04),
        'reminder':(305,.15,.35,1.07,1.08,.33),
    }
    base,first_dur,last_dur,first_end,last_end,gap=config[event]
    if abstract:
        # Wordless, legato harmonics: no z-frication, no b closure or l articulation.
        first=voiced('oo',first_dur,base*1.48,first_end,breath=.002,soft=True)
        last=voiced('oo',last_dur,base*1.12,last_end,breath=.003,soft=True)
        if event=='rest': return np.concatenate([last,silence(.18)])
        return np.concatenate([first,silence(gap),last,silence(.18)])
    # A small voiced /z/, a narrow /i/, then soft b-release and an l->oo transition.
    zt=np.arange(round(.035*SR))/SR
    z=fade(.045*band_noise(len(zt),3400,1300)+.12*np.sin(TAU*base*zt),.006,.008)
    first=np.concatenate([z,voiced('i',first_dur,base*1.12,first_end)])
    release=fade(.03*band_noise(round(.012*SR),1000,650),.002,.006)
    last=np.concatenate([release,voiced('l',.047,base,last_end**.1),
                         voiced('oo',last_dur,base,last_end,breath=.012)])
    if event=='rest': return np.concatenate([last,silence(.18)])
    return np.concatenate([first,silence(gap),last,silence(.18)])


class NameSynth:
    """Only synthetic phoneme output; AUDIO_OUTPUT_SYNCHRONOUS never opens audio."""
    def __init__(self):
        self.lib=c.CDLL('libespeak-ng.so.1')
        self.lib.espeak_Initialize.argtypes=[c.c_int,c.c_int,c.c_char_p,c.c_int]
        self.lib.espeak_Initialize.restype=c.c_int
        self.rate=self.lib.espeak_Initialize(2,0,None,0x8000)
        if self.rate<=0: raise RuntimeError('eSpeak NG data unavailable')
        self.lib.espeak_SetVoiceByName.argtypes=[c.c_char_p]
        if self.lib.espeak_SetVoiceByName(b'en'): raise RuntimeError('eSpeak English voice unavailable')
        self.lib.espeak_SetParameter.argtypes=[c.c_int,c.c_int,c.c_int]
        self.lib.espeak_Synth.argtypes=[c.c_void_p,c.c_size_t,c.c_uint,c.c_int,c.c_uint,c.c_uint,c.c_void_p,c.c_void_p]
        self.lib.espeak_Synth.restype=c.c_int
        self.parts=[]
        callback=c.CFUNCTYPE(c.c_int,c.POINTER(c.c_short),c.c_int,c.c_void_p)
        def collect(ptr,count,_events):
            if ptr and count: self.parts.append(np.ctypeslib.as_array(ptr,shape=(count,)).copy())
            return 0
        self.callback=callback(collect)
        self.lib.espeak_SetSynthCallback.argtypes=[callback]
        self.lib.espeak_SetSynthCallback(self.callback)

    def phonemes(self,text,speed,pitch):
        self.parts=[]
        for key,value in [(1,speed),(2,80),(3,pitch),(4,22)]:
            if self.lib.espeak_SetParameter(key,value,0): raise RuntimeError('eSpeak parameter failed')
        payload=c.create_string_buffer(text.encode())
        if self.lib.espeak_Synth(payload,len(payload),0,1,0,0x101,None,None):
            raise RuntimeError('eSpeak synthesis failed')
        if not self.parts: raise RuntimeError('No phoneme audio generated')
        x=np.concatenate(self.parts).astype(np.float64)/32768
        active=np.flatnonzero(abs(x)>.003)
        if not len(active): raise RuntimeError('Silent phoneme audio')
        x=x[max(0,active[0]-round(.008*self.rate)):min(len(x),active[-1]+round(.055*self.rate))]
        # 2× upsample with interpolation; soften excess upper harmonics with a smooth filter.
        x=np.interp(np.arange(round(len(x)*SR/self.rate))*self.rate/SR,np.arange(len(x)),x)
        bins=np.fft.rfftfreq(len(x),1/SR)
        x=np.fft.irfft(np.fft.rfft(x)/(1+(bins/3800)**6),n=len(x))
        return fade(x,.007,.03)

    def render(self,event):
        speed,pitch={'greet':(170,77),'work':(205,88),'rest':(125,64),
                     'complete':(158,87),'reminder':(174,80)}[event]
        if event=='reminder':
            return np.concatenate([self.phonemes("[[z'i:]]",190,pitch),silence(.33),
                                   self.phonemes("[[bl'u:]]",speed,pitch+3),silence(.18)])
        phoneme="[[bl'u:]]" if event=='rest' else "[[z'i:bl'u:]]"
        return np.concatenate([self.phonemes(phoneme,speed,pitch),silence(.18)])

    def close(self): self.lib.espeak_Terminate()


def finish(x):
    # Light shared early reflections, enough to connect the syllables without a long echo.
    x=np.concatenate([x,silence(.13)]);dry=x.copy()
    for seconds,level in [(.029,.07),(.061,.035)]:
        d=round(seconds*SR);x[d:]+=dry[:-d]*level
    active=x[abs(x)>.003]
    x*=min(.15/(np.sqrt(np.mean(active*active))+1e-9),.69/(max(abs(x))+1e-9))
    return fade(x,.005,.035)


def save(file,x,report):
    with wave.open(str(ROOT/'audio'/file),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR)
        f.writeframes(np.round(x*32767).astype('<i2').tobytes())
    report.append({'file':file,'seconds':round(len(x)/SR,3),
                   'peakDbFS':round(20*np.log10(max(abs(x))),2),
                   'rmsDbFS':round(20*np.log10(np.sqrt(np.mean(x*x))),2)})


def main():
    (ROOT/'audio').mkdir(exist_ok=True)
    engine=NameSynth();report=[]
    manifest={'version':2,'status':'exploration-not-selected','sampleRate':SR,
              'events':[dict(id=i,name=n,intent=t) for i,n,t in EVENTS],'voices':[],'textures':[]}
    raw={};greetings=[]
    try:
        for id,letter,name,spelling,description,note,color in VOICES:
            clips={};event_audio=[]
            for event,_,_ in EVENTS:
                x=engine.render(event) if id=='clear' else creature_pair(event,abstract=id=='motif')
                raw[id,event]=x
                x=finish(x);file=f'{id}-{event}.wav';save(file,x,report)
                clips[event]='audio/'+file
                if event=='greet': greetings.append(x)
                else: event_audio.extend([x,silence(.45)])
            seq=f'{id}-sequence.wav';save(seq,np.concatenate(event_audio),report)
            manifest['voices'].append(dict(id=id,letter=letter,name=name,spelling=spelling,description=description,
                                           note=note,color=color,clips=clips,sequence='audio/'+seq))
    finally: engine.close()
    save('compare-three.wav',np.concatenate([part for x in greetings for part in [x,silence(.65)]]),report)
    manifest['comparison']='audio/compare-three.wav'
    spec=importlib.util.spec_from_file_location('previous_sound_round',ROOT.parent/'generate.py')
    legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
    # Preserve the seven timbres the user shortlisted, using the same B-name call each time.
    base=raw['creature','greet']
    for style,number,name,_,_,_,color in legacy.STYLES:
        if style=='bubble': continue
        x=base.copy()
        if style!='murmur':
            x=x/(np.sqrt(np.mean(x*x))+1e-9)*.115
            for at,dur,freq in [(0,.14,620),(.26,.40,440)]:
                accent=legacy.note(style,freq,dur)
                accent=accent/(np.sqrt(np.mean(accent*accent))+1e-9)*.032
                offset=round(at*SR);count=min(len(accent),len(x)-offset)
                x[offset:offset+count]+=accent[:count]
        x=finish(x);file=f'texture-{style}.wav';save(file,x,report)
        manifest['textures'].append(dict(id=style,number=number,name=name,color=color,file='audio/'+file))
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'audio-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'Generated {len(report)} WAVs: 3 voices × 5 calls, 3 event sequences, A/B/C comparison, 7 B-texture comparisons.')


if __name__=='__main__': main()
