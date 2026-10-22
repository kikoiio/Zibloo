"""Original, deterministic DSP sketches. Run with Python + numpy; no samples/services."""
from pathlib import Path
import json
import wave
import numpy as np

ROOT = Path(__file__).resolve().parent
SR = 44100
TAU = 2 * np.pi
RNG = np.random.default_rng(20261022)
STYLES = [
    ('bubble', '01', '潮汐泡泡', '像 Zibloo 在水里发出「啵、噜」的短叫声。', '有机 · 轻快 · 海洋感', '角色声音首选', '#3c8986'),
    ('murmur', '02', '温柔咕噜', '圆润的无词拟声，带一点「呜噜」的亲近感。', '温暖 · 拟声 · 陪伴感', '角色声音候选', '#688a72'),
    ('glass', '03', '水光玻璃', '透亮的玻璃共鸣，收尾留下一点水面的余韵。', '清透 · 克制 · 现代', '简洁提示候选', '#668b9c'),
    ('wood', '04', '海岸木音', '短促木质敲击，柔软、有节奏，适合频繁切换。', '自然 · 干净 · 节奏感', '耐听预设候选', '#aa8057'),
    ('orbit', '05', '小小电波', '会滑音的柔和电子短句，像一个机灵的小伙伴。', '灵巧 · 电子 · 未来感', '活泼预设候选', '#788b46'),
    ('air', '06', '浮游气息', '带气息的轻哨与泛音，像从水面轻轻呼唤你。', '空灵 · 舒缓 · 留白', '安静场景候选', '#7d9b92'),
    ('pluck', '07', '暖弦涟漪', '轻拨琴弦的颗粒和共鸣，带一点手作的温度。', '柔和 · 音乐感 · 松弛', '温暖预设候选', '#aa765f'),
    ('pulse', '08', '跃动节拍', '中频更鲜明的合成打击，提醒意图更明确。', '醒目 · 干脆 · 动感', '训练场景候选', '#bc7258'),
]
EVENTS = [
    ('work', '开始工作', '短而上扬：准备好了，开始吧。'),
    ('rest', '进入休息', '慢而下行：松一口气，歇一下。'),
    ('complete', '全部完成', '舒展地收束：完成啦，为你开心。'),
    ('reminder', '日常提醒', '两次呼唤，中间留白：有件事等着你。'),
]
# Shared rhythmic vocabulary; each voice also has its own register and articulation.
PHRASES = {
    'work': [(0, 0, .24), (.32, 5, .38)],
    'rest': [(0, 5, .40), (.48, 0, .55)],
    'complete': [(0, 0, .23), (.30, 4, .23), (.60, 7, .52), (.98, 12, .44)],
    'reminder': [(0, 7, .26), (.29, 4, .30), (.98, 7, .26), (1.27, 4, .40)],
}


def fade(x, attack=.012, release=.035):
    x = x.copy()
    a, r = min(len(x)//2, int(attack*SR)), min(len(x)//2, int(release*SR))
    x[:a] *= np.sin(np.linspace(0, np.pi/2, a))**2
    x[-r:] *= np.cos(np.linspace(0, np.pi/2, r))**2
    return x


def note(style, freq, dur, rest=False):
    t = np.arange(int(SR*dur))/SR
    u = t/dur
    if style == 'bubble':
        f = freq*(1.35-.51*(1-np.exp(-u*6))+.06*np.sin(TAU*3*t))
        p = TAU*np.cumsum(f)/SR
        x = np.sin(p + .65*np.sin(p*.5)) + .2*np.sin(p*2.03)
        x *= np.exp(-3*u)
        # A smaller answer bubble makes a tiny creature gesture, not a melody alone.
        delay = int(.065*SR)
        x[delay:] += .22*np.sin(p[:-delay]*1.7)*np.exp(-5*u[:-delay])
    elif style == 'murmur':
        f = freq*(.96+.13*np.sin(np.pi*u)-.05*u)*(1+.008*np.sin(TAU*6*t))
        p = TAU*np.cumsum(f)/SR
        x = np.zeros_like(t)
        # Moving formants: rounded oo -> oh, without speech or a sampled person.
        for h in range(1, 18):
            hz = h*freq
            weight = (.8*np.exp(-((hz-(610+150*u))/240)**2)
                      +.35*np.exp(-((hz-1250)/390)**2)+.12/h)
            x += weight*np.sin(h*p)/np.sqrt(h)
        x *= np.sin(np.pi*np.minimum(u/.98, 1))**.85
    elif style == 'glass':
        x = sum(amp*np.sin(TAU*freq*ratio*t)*np.exp(-decay*u)
                for ratio, amp, decay in [(1,1,2.4),(2.76,.28,5),(4.12,.09,7)])
    elif style == 'wood':
        x = (np.sin(TAU*freq*t)*np.exp(-7*u)
             +.44*np.sin(TAU*freq*2.72*t)*np.exp(-15*u)
             +.15*np.sin(TAU*freq*4.83*t)*np.exp(-23*u))
        x += .04*RNG.normal(size=len(t))*np.exp(-80*u)
    elif style == 'orbit':
        p = TAU*np.cumsum(freq*(.86+.14*np.minimum(u*6,1)))/SR
        x = np.sin(p+1.3*np.sin(p*2)*np.exp(-4*u))+.15*np.sin(p*.5)
        x *= np.exp(-1.8*u)*(1-.12*np.cos(TAU*9*t))
    elif style == 'air':
        noise = RNG.normal(size=len(t))
        bins = np.fft.rfftfreq(len(t), 1/SR)
        breath = np.fft.irfft(np.fft.rfft(noise)*np.exp(-((bins-1300)/500)**2), n=len(t))
        p = TAU*freq*t+.025*np.sin(TAU*4*t)
        x = (.65*np.sin(p)+.10*np.sin(2*p)+.22*breath)*np.sin(np.pi*u)**1.25
    elif style == 'pluck':
        x = sum(((-1)**(h+1)/h**1.35)*np.sin(TAU*freq*h*t)*np.exp(-(2+h*.75)*u)
                for h in range(1,12))
        x += .13*np.sin(TAU*freq*1.004*t)*np.exp(-2*u)
    else:
        p = TAU*np.cumsum(freq*(1+.4*np.exp(-t*45)))/SR
        x = np.sin(p)+.26*np.sin(2*p)+.11*np.sin(3*p)
        x *= np.exp(-4*u)
        x += .06*RNG.normal(size=len(t))*np.exp(-65*u)
    return fade(x, .022 if style in ['murmur','air'] else .007, .06)


def render(style, event):
    base = {'bubble':580,'murmur':280,'glass':700,'wood':470,'orbit':440,'air':820,'pluck':390,'pulse':490}[style]
    stretch = 1.22 if style == 'air' else 1.12 if style == 'murmur' else 1
    if event == 'rest': base *= .89
    output = np.zeros(int(3.15*SR))
    end = 0
    for start, semitone, duration in PHRASES[event]:
        start, duration = start*stretch, duration*stretch
        if event == 'rest': duration *= 1.10
        x = note(style, base*2**(semitone/12), duration, event=='rest')
        at = int(start*SR)
        output[at:at+len(x)] += x
        end = max(end, at+len(x))
    output = output[:end+int(.30*SR)]
    # Gentle short room response, never a long ambient bed.
    dry = output.copy()
    for seconds, level in [(0.043,.12),(.089,.07),(.149,.035)]:
        d = int(seconds*SR)
        output[d:] += dry[:-d]*level
    active = output[np.abs(output)>.004]
    rms = np.sqrt(np.mean(active**2))
    output *= min(.14/max(rms,1e-9), .72/max(np.max(np.abs(output)),1e-9))
    return fade(output, .004, .025)


def save(name, x):
    with wave.open(str(ROOT/'audio'/name), 'wb') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((x*32767).astype('<i2').tobytes())


def main():
    (ROOT/'audio').mkdir(exist_ok=True)
    manifest = {'version':1,'sampleRate':SR,'status':'exploration-not-selected',
                'events':[{'id':i,'name':n,'intent':s} for i,n,s in EVENTS], 'styles':[]}
    report = []
    for id, number, name, desc, tags, role, color in STYLES:
        clips = []
        for event, _, _ in EVENTS:
            x = render(id, event)
            file = f'{id}-{event}.wav'
            save(file, x)
            clips.append(x)
            report.append({'file':file,'seconds':round(len(x)/SR,3),
                           'peakDbFS':round(20*np.log10(max(abs(x))),2),
                           'rmsDbFS':round(20*np.log10(np.sqrt(np.mean(x*x))),2)})
        sequence = np.concatenate([part for x in clips for part in [x,np.zeros(int(.42*SR))]])
        save(f'{id}-sequence.wav', sequence)
        manifest['styles'].append(dict(id=id,number=number,name=name,description=desc,tags=tags,role=role,color=color,
                                       sequence=f'audio/{id}-sequence.wav',
                                       clips={e:f'audio/{id}-{e}.wav' for e,_,_ in EVENTS}))
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'audio-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(f'Generated {len(STYLES)} styles × {len(EVENTS)} events + 8 comparison sequences.')


if __name__ == '__main__':
    main()
