import json, sys, numpy as np
from PIL import Image, ImageDraw, ImageFont
R = "C:/Users/Admin/Downloads/tokw_v0_4_0/runs/"
OUT = sys.argv[1]
FONT = ImageFont.truetype("C:/Windows/Fonts/Inkfree.ttf", 14)
FONT_S = ImageFont.truetype("C:/Windows/Fonts/Inkfree.ttf", 13)

def quad(th):
    return ("upper-" if np.cos(th) >= 0 else "lower-") + ("right" if np.sin(th) < 0 else "left")  # screen convention (matches pendulum_gt_kripke.py)
def rot(td):
    return "clockwise" if td < 0 else "anticlockwise"

def short(t):
    return t.replace("the pendulum is ", "").replace("pointing downwards", "pointing down").replace("moving towards the ", "moving to ").replace("towards", "to")

def make_gif(run, kripke_rel, vid, out, step=2, size=210):
    st = np.load(R + run + "/tokw_v0_4_0_states.npz"); m = st["state_index"][:, 0] == vid
    states = st["states"][m]; fr = st["state_index"][m][:, 1]
    order = np.argsort(fr); states = states[order]
    k = json.load(open(R + run + "/" + kripke_rel))
    segs = [s for s in k["kripke_by_timescale"]["event"]["raw_segments"] if s["video_id"] == vid]
    def vlm_at(f):
        for s in segs:
            if s["start"] <= f < s["end"]:
                return " · ".join(short(t) for t in s["label_text"][:2]) or "(no label)"
        return " · ".join(short(t) for t in segs[-1]["label_text"][:2])
    fps = 20.0
    frames = []
    n = len(states)
    td = states[:, 1]
    rev = set(np.where(np.sign(td[1:]) != np.sign(td[:-1]))[0] + 1)
    for f in range(0, n, step):
        im = Image.open(f"{R}{run}/frames/video_{vid:05d}/frame_{f:06d}.jpg").convert("RGB").resize((size, size))
        W, H = 256, size + 62
        c = Image.new("RGB", (W, H), (255, 255, 255)); c.paste(im, ((W - size) // 2, 0))
        ImageDraw.Draw(c).rectangle([0, size, W, H], fill=(253, 251, 244))
        d = ImageDraw.Draw(c)
        d.line([(0, size), (W, size)], fill=(60, 58, 52), width=1)
        th, w = states[f]
        d.text((6, size + 4), f"physics: {quad(th)}, {rot(w)}", font=FONT, fill=(26, 110, 60))
        d.text((6, size + 23), f"VLM: {vlm_at(f)}", font=FONT, fill=(196, 84, 30))
        # progress bar
        p = f / (n - 1)
        d.line([(6, H - 10), (W - 6, H - 10)], fill=(214, 208, 192), width=3)
        d.line([(6, H - 10), (6 + p * (W - 12), H - 10)], fill=(60, 58, 52), width=3)
        d.text((W - 46, 4), f"{f / fps:4.1f}s", font=FONT_S, fill=(90, 86, 78))
        if any(abs(f - r) <= 1 for r in rev):
            d.text((6, 4), "reversal!", font=FONT_S, fill=(196, 40, 60))
        frames.append(c.quantize(colors=48, method=Image.Quantize.MEDIANCUT))
    frames[0].save(out, save_all=True, append_images=frames[1:], duration=int(1000 * step / fps), loop=0, optimize=True)
    print(out, len(frames))

make_gif("pendulum_15s", "tokw_v0_4_0_grounded_final/tokw_v0_4_0_grounded_kripke.json", 9, OUT + "/pendulum15s_ep09.gif")
make_gif("pendulum", "tokw_v0_4_0_grounded/tokw_v0_4_0_grounded_kripke.json", 1, OUT + "/pendulum10s_ep01.gif")

# --- chart data: surprise vs angular velocity, episode 9 (15 s run)
st = np.load(R + "pendulum_15s/tokw_v0_4_0_states.npz"); m = st["state_index"][:, 0] == 9
order = np.argsort(st["state_index"][m][:, 1]); S = st["states"][m][order]
L = np.load(R + "pendulum_15s/tokw_v0_4_0_latents_surprise.npz"); mm = L["index"][:, 0] == 9
o2 = np.argsort(L["index"][mm][:, 1]); sur = L["surprise"][mm][o2]
td = S[:, 1]; rev = (np.where(np.sign(td[1:]) != np.sign(td[:-1]))[0] + 1).tolist()
k = json.load(open(R + "pendulum_15s/tokw_v0_4_0_grounded_final/tokw_v0_4_0_grounded_kripke.json"))
cuts = sorted({s["start"] for s in k["kripke_by_timescale"]["event"]["raw_segments"] if s["video_id"] == 9} - {0})
data = {"fps": 20, "theta_dot": [round(float(x), 3) for x in td], "surprise": [round(float(x), 4) for x in sur],
        "reversals": rev, "cuts": cuts}
pass
print("rev", rev, "cuts", cuts, "sur max", float(sur.max()), "median", float(np.median(sur)))
