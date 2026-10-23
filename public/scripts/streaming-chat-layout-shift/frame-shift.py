#!/usr/bin/env python3
"""
逐帧量化录屏里的内容竖向位移，找出「内容往下跳」的帧。

用法：
    python3 frame-shift.py rec.mp4 --density 2.75
    python3 frame-shift.py rec.mp4 --density 2.0 --top 0.08 --bottom 0.87 --all

依赖：ffmpeg / ffprobe 在 PATH 里，Python 装了 numpy（pip install numpy）。

做法：
  1. 按原始帧解码，不做任何帧率重采样。adb screenrecord 是可变帧率，只在画面更新时出帧，
     重采样到固定帧率会把只停留一两帧的闪跳合并掉。
  2. 只取列表区域（--top / --bottom 是占整屏高度的比例），避开状态栏、输入框和键盘。
  3. 每帧算一条「行亮度剖面」（每一行像素的平均亮度），在上下若干像素内平移上一帧的剖面，
     找到误差最小的偏移量，就是这一帧内容相对上一帧的竖向位移。
  4. 位移换算成 dp（除以 --density），正值 = 内容往下移。聊天列表 reverseLayout 底部固定，
     正常吐字只会往上推；往下移的帧就是要查的跳动。

注意：键盘收起、输入框移动也会被算成位移，报出来的帧要对着截图确认。
"""
import argparse
import json
import subprocess

import numpy as np


def probe(mp4, args):
    return subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', *args, mp4],
                          capture_output=True, text=True, check=True).stdout


def main():
    ap = argparse.ArgumentParser(description='逐帧量化录屏里的内容竖向位移')
    ap.add_argument('mp4')
    ap.add_argument('--density', type=float, required=True, help='设备 dp 缩放，adb shell wm density 的值 / 160')
    ap.add_argument('--top', type=float, default=0.08, help='分析区域上沿，占整屏高度比例')
    ap.add_argument('--bottom', type=float, default=0.87, help='分析区域下沿，占整屏高度比例')
    ap.add_argument('--threshold', type=float, default=2.0, help='超过多少 dp 的下移算跳动')
    ap.add_argument('--all', action='store_true', help='打印每一帧，而不只是跳动的帧')
    a = ap.parse_args()

    info = json.loads(probe(a.mp4, ['-show_entries', 'stream=width,height', '-of', 'json']))['streams'][0]
    vw, vh = info['width'], info['height']
    ts = [float(x) for x in probe(a.mp4, ['-show_entries', 'frame=pts_time', '-of', 'csv=p=0']).split()]

    # 缩到 360 宽再分析：位移精度够用，内存只有原图的几十分之一
    y0, ch = int(vh * a.top), int(vh * (a.bottom - a.top))
    w = 360
    h = int(ch * w / vw)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.mp4, '-fps_mode', 'passthrough',
                          '-vf', f'crop={vw}:{ch}:0:{y0},scale={w}:{h},format=gray', '-f', 'rawvideo', '-'],
                         capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)
    assert len(frames) == len(ts), '解码帧数与时间戳数量不一致'
    px_per_scaled = vw / w

    intervals = np.diff(ts)
    print(f'{vw}x{vh}，{len(frames)} 帧，帧间隔中位数 {np.median(intervals) * 1000:.1f} ms')

    jumps = 0
    for i in range(1, len(frames)):
        diff = float(np.abs(frames[i] - frames[i - 1]).mean())
        shift_dp = 0.0
        if diff > 0.3:  # 画面基本没变就不算位移
            prev, cur = frames[i - 1].mean(axis=1), frames[i].mean(axis=1)
            best_err, best = float('inf'), 0
            for s in range(-h // 4, h // 4 + 1):
                x, y = (prev[:h - s], cur[s:]) if s >= 0 else (prev[-s:], cur[:h + s])
                err = float(np.mean((x - y) ** 2))
                if err < best_err:
                    best_err, best = err, s
            shift_dp = best * px_per_scaled / a.density
        down = shift_dp > a.threshold
        jumps += down
        if a.all or down:
            mark = '  <- 下移' if down else ''
            print(f'帧 {i:4d}  t={ts[i]:7.3f}s  间隔 {(ts[i] - ts[i - 1]) * 1000:6.1f} ms  '
                  f'差异 {diff:5.2f}  位移 {shift_dp:+6.1f} dp{mark}')
    print(f'下移超过 {a.threshold} dp 的帧：{jumps} 个')


if __name__ == '__main__':
    main()
