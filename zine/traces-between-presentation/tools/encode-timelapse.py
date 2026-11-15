"""Encode the saved, reproducible random edit. Requires an ffmpeg executable, not a server."""
from pathlib import Path
import argparse,json,subprocess,tempfile
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);p.add_argument('--frames',type=Path,default=root/'reference/panorama-frames');p.add_argument('--output',type=Path,required=True);a=p.parse_args()
if a.output.exists():raise SystemExit('Choose a new output filename; existing files are preserved.')
d=json.loads((root/'reference/timelapse-sequence.json').read_text());lines=['ffconcat version 1.0']
for frame in d['sequence']:
 image=(a.frames/frame['file']).resolve();assert image.is_file(),image
 lines.extend(["file '"+str(image).replace("'", "'\\''")+"'",'option framerate 24',f"duration {frame['seconds']:.12f}"])
lines.extend(["file '"+str((a.frames/d['sequence'][-1]['file']).resolve()).replace("'", "'\\''")+"'",'option framerate 24'])
with tempfile.TemporaryDirectory() as tmp:
 manifest=Path(tmp)/'sequence.ffconcat';manifest.write_text('\n'.join(lines)+'\n')
 subprocess.run([a.ffmpeg,'-hide_banner','-loglevel','warning','-f','concat','-safe','0','-i',str(manifest),'-vf','fps=24,scale=in_range=pc:out_range=tv:out_color_matrix=bt709','-frames:v',str(d['totalFrames']),'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-an','-movflags','+faststart','-video_track_timescale','24000',str(a.output)],check=True)
