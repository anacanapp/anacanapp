import json, subprocess, glob, sys
V='/home/user/anacanapp/scripts/store-screenshots/v2'
def dur(f): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]).decode())
X=0.4  # crossfade
def build(key, fmt):
    src = f'{V}/out/az-cpp-{key}' if fmt=='ios' else f'{V}/out-android/az-cpp-{key}'
    W,H = (886,1920) if fmt=='ios' else (1080,1920)
    imgs = sorted(glob.glob(src+'/0*.png'))
    voices = [f'tts/{key}-{i+1}.mp3' for i in range(len(imgs))]
    D = [max(3.0, dur(v)+0.75) for v in voices]; D[-1] += 1.2
    total = sum(D) - X*(len(D)-1)
    inp=[]; fl=[]
    for i,(im,d) in enumerate(zip(imgs,D)):
        inp += ['-loop','1','-t',f'{d:.3f}','-i',im]
        fr=int(d*30); z0,z1=(1.0,1.03) if i%2==0 else (1.03,1.0)
        fl.append(f"[{i}:v]scale={W*2}:{H*2},zoompan=z='{z0}+({z1}-{z0})*on/{fr}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={fr}:s={W}x{H}:fps=30,format=yuv420p,setsar=1[v{i}]")
    last='v0'; off=0
    for i in range(1,len(imgs)):
        off += D[i-1]-X
        fl.append(f"[{last}][v{i}]xfade=transition=fade:duration={X}:offset={off:.3f}[x{i}]"); last=f'x{i}'
    n=len(imgs); starts=[]; t=0
    for i,d in enumerate(D): starts.append(t+0.25 if i else 0.35); t+=d-X
    for i,v in enumerate(voices): inp += ['-i',v]
    inp += ['-i','music.mp3']
    a=[f"[{n+i}:a]adelay={int(starts[i]*1000)}|{int(starts[i]*1000)},volume=1.0[a{i}]" for i in range(n)]
    a.append(f"[{2*n}:a]atrim=0:{total:.3f},afade=t=in:d=1,afade=t=out:st={total-1.5:.3f}:d=1.5,volume=0.16[m]")
    a.append(''.join(f'[a{i}]' for i in range(n))+f"[m]amix=inputs={n+1}:normalize=0,alimiter=limit=0.95,aformat=channel_layouts=stereo[aout]")
    out=f'out/anacan-{key}-{"appstore-886x1920" if fmt=="ios" else "1080x1920"}.mp4'
    cmd=['ffmpeg','-y','-loglevel','error',*inp,'-filter_complex',';'.join(fl+a),'-map',f'[{last}]','-map','[aout]','-t',f'{total:.3f}',
         '-c:v','libx264','-profile:v','high','-level','4.0','-pix_fmt','yuv420p','-r','30','-b:v','10M','-c:a','aac','-b:a','256k','-ar','44100','-movflags','+faststart',out]
    subprocess.check_call(cmd); print(out, round(total,2))
import os; os.makedirs('out',exist_ok=True)
for k in sys.argv[1:]:
    for fmt in ['ios','android']: build(k,fmt)
