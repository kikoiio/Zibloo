"""Temporary wordless voice sketches: irregular breath/phonation, no TTS or AI service."""
from pathlib import Path
import json
import wave
import numpy as np

ROOT=Path(__file__).resolve().parent
SR=44100
TAU=2*np.pi
rng=np.random.default_rng(314159)
EVENTS=[('work','开始工作','轻快、短促，给一个开始的回应。'),
        ('rest','进入休息','放慢、松开，用较轻的尾音收住。'),
        ('complete','全部完成','先惊喜，再用两三下短呼声展开。'),
        ('reminder','日常提醒','先轻唤，留白后再回应一次。')]
STYLES=[
    ('coo','D','轻声咕呼','柔软的呼气接圆润咕声，尝试安静、靠近的陪伴感。','轻呼吸 · 圆润 · 松弛','#5d8d7c',310,.80,.025),
    ('chirrup','E','灵巧啾噜','较轻亮的短啾接小段颤动，用不均匀的节奏尝试活泼感。','短啾 · 弹性 · 灵巧','#539392',395,.58,.014),
    ('hum','F','温暖哼鸣','从闭口的轻哼慢慢打开，尝试更沉稳、收敛的声音。','轻哼 · 中音 · 克制','#9e865c',255,.98,.012),
    ('breeze','G','清透轻呼','带一点气息的轻鸣，起音和释放都更舒缓。','轻鸣 · 气息 · 透明','#769b9b',445,.72,.065),
]


def curve(u,values): return np.interp(u,np.linspace(0,1,len(values)),values)
def silence(t): return np.zeros(round(t*SR))
def fade(x,a=.012,r=.035):
    x=x.copy();a=min(round(a*SR),len(x)//2);r=min(round(r*SR),len(x)//2)
    if a:x[:a]*=np.sin(np.linspace(0,np.pi/2,a))**2
    if r:x[-r:]*=np.cos(np.linspace(0,np.pi/2,r))**2
    return x
def noise(n,center=1300,width=1100):
    f=np.fft.rfftfreq(n,1/SR)
    y=np.fft.irfft(np.fft.rfft(rng.normal(size=n))*np.exp(-((f-center)/width)**2),n=n)
    return y/(np.sqrt(np.mean(y*y))+1e-9)
def breath(dur=.08,level=.025):
    x=noise(round(SR*dur),1700,1000)
    return fade(x,.025,.04)*level


def syllable(style,duration,pitch_points,opening_points,strength=1,gesture='normal'):
    id,_,_,_,_,_,base,tilt,air=style
    n=round(duration*SR);t=np.arange(n)/SR;u=t/duration
    # Slow irregular drift + tiny fast jitter: no repeated perfect oscillator phrase.
    drift=np.interp(u,np.linspace(0,1,11),rng.normal(0,.004,11))
    f=base*curve(u,pitch_points)*(1+drift+.002*np.sin(TAU*31*t))
    phase=TAU*np.cumsum(f)/SR
    openness=curve(u,opening_points)
    f1=290+360*openness;f2=710+650*openness;f3=2250+280*openness
    if id=='chirrup': f2+=220;f3+=400
    if id=='hum': f1-=35;f2-=100
    signal=np.zeros(n)
    # A softer glottal spectrum passes through moving vowel resonances, with no hard consonants.
    for h in range(1,31):
        hz=h*f
        resonances=(np.exp(-((hz-f1)/220)**2)+.34*np.exp(-((hz-f2)/440)**2)
                    +.07*np.exp(-((hz-f3)/650)**2))
        weight=(.12/(h**1.5)+resonances/(h**tilt))*np.exp(-h/28)
        if id=='hum': weight+=.15*np.exp(-((hz-280)/140)**2)/h
        if id=='breeze': weight*=np.exp(-h/7)
        signal+=weight*np.sin(h*phase+.06*np.sin(TAU*(2.5+.11*h)*t))
    shape=curve(u,[0,.48,1,.87,.65,.30,0])
    if gesture=='release':shape=curve(u,[0,.8,1,.72,.40,.12,0])
    elif gesture=='smile':shape=curve(u,[0,.92,.70,1,.68,.27,0])
    if id=='chirrup':shape*=1-.16*np.sin(TAU*(9*t+1.8*t*t))**2
    if id=='coo':shape*=1-.035*np.sin(TAU*5.3*t)
    shimmer=np.interp(u,np.linspace(0,1,14),rng.uniform(.94,1.02,14))
    signal=(signal*shape*shimmer+air*noise(n)*shape*(.6+.4*u))*strength
    return fade(signal,.016,.045)


def gesture(style,event):
    id=style[0]
    syll=lambda dur,p,o,gain=1,g='normal':syllable(style,dur,p,o,gain,g)
    if event=='greet':
        # Notice -> tiny hesitation -> curious answer. Different registers/articulation per voice.
        x=np.concatenate([breath(.075,.018),silence(.025),
            syll(.18,[.91,1.10,1.16,1.05],[.10,.20,.55,.40],.85),silence(.08),
            syll(.39,[1.02,.96,1.06,1.23,1.17],[.40,.60,.34,.20],1,'smile')])
    elif event=='work':
        x=np.concatenate([syll(.13,[.96,1.06,1.08],[.25,.65,.30],.90),silence(.075),
            syll(.25,[1.0,.98,1.17,1.13],[.30,.70,.50,.23],1.05)])
    elif event=='rest':
        x=np.concatenate([breath(.12,.027),silence(.03),
            syll(.68,[1.08,1.02,.94,.88,.84],[.72,.55,.28,.12,.10],.80,'release')])
    elif event=='complete':
        # Surprise + three unequal, smiling puffs; a vocal gesture rather than an arpeggio.
        x=np.concatenate([breath(.06,.019),syll(.12,[1.04,1.25,1.20],[.35,.75,.42],.85),silence(.11),
            syll(.20,[1.12,1.03,1.10],[.50,.75,.28],1,'smile'),silence(.065),
            syll(.14,[1.07,1.14,1.0],[.40,.65,.20],.83),silence(.04),
            syll(.34,[1.08,1.20,1.11,.98],[.45,.62,.31,.14],1,'smile')])
    else:
        first=syll(.26,[1,1.08,1.16,1.07],[.15,.55,.33],.85)
        second=syll(.39,[1.03,1.07,1.20,1.04],[.3,.65,.43,.18],1)
        x=np.concatenate([first,silence(.36),second])
    if id=='chirrup':
        x=np.interp(np.arange(round(len(x)*.91))/.91,np.arange(len(x)),x)
    if id=='hum':
        x=np.tanh(x*1.15)/1.15
    return x


def master(x,event):
    x=np.concatenate([silence(.025),x,silence(.20)])
    x-=np.mean(x)
    dry=x.copy()
    for delay,amp in [(.019,.065),(.041,.026)]:
        d=round(delay*SR);x[d:]+=dry[:-d]*amp
    active=x[abs(x)>.003]
    gain=min(.14/(np.sqrt(np.mean(active*active))+1e-9),.66/(max(abs(x))+1e-9))
    x*=gain*(.87 if event=='rest' else 1)
    return fade(x,.006,.075)


def save(file,x,report):
    with wave.open(str(ROOT/'audio'/file),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(SR);f.writeframes(np.round(x*32767).astype('<i2').tobytes())
    report.append(dict(file=file,seconds=round(len(x)/SR,3),peakDbFS=round(20*np.log10(max(abs(x))),2),rmsDbFS=round(20*np.log10(np.sqrt(np.mean(x*x))),2)))


def main():
    (ROOT/'audio').mkdir(parents=True,exist_ok=True)
    m=dict(version=3,status='temporary-sketches-not-selected',events=[dict(id=i,name=n,intent=t)for i,n,t in EVENTS],styles=[])
    report=[];greetings=[]
    for style in STYLES:
        id,number,name,desc,tags,color,*_=style;clips={};seq=[]
        for event in ['greet']+[e[0]for e in EVENTS]:
            x=master(gesture(style,event),event);file=f'{id}-{event}.wav';save(file,x,report)
            if event=='greet':greetings.append(x)
            else:clips[event]='audio/'+file;seq.extend([x,silence(.45)])
        seqfile=f'{id}-sequence.wav';save(seqfile,np.concatenate(seq),report)
        m['styles'].append(dict(id=id,number=number,name=name,description=desc,tags=tags,color=color,role='临时合成草稿',
                                greeting=f'audio/{id}-greet.wav',sequence='audio/'+seqfile,clips=clips,
                                useUrl='../../?voice=temp-'+id+'#settings'))
    save('compare-greetings.wav',np.concatenate([part for x in greetings for part in[x,silence(.55)]]),report)
    m['comparison']='audio/compare-greetings.wav'
    (ROOT/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'audio-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'{len(report)} short WAV files generated; no TTS, samples, model downloads or cloud generation.')


if __name__=='__main__':main()
