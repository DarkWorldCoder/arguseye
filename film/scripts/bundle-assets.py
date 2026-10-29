"""Bundles the live captures and the narration word timings into scripts the composition loads synchronously."""
import json, os
here = os.path.dirname(os.path.abspath(__file__))
film = os.path.dirname(here)
live = os.path.join(film, "assets/live")
names = ["pricing", "pricing-starter", "signin", "stats", "toast", "profile", "command", "vue-meter"]
out = {n: json.load(open(os.path.join(live, n + ".json"))) for n in names}
open(os.path.join(live, "replicas.js"), "w").write("window.__REPLICAS = " + json.dumps(out) + ";\n")
words = json.load(open(os.path.join(film, "assets/audio/words2.json")))["words"]
words = [[w["text"], round(w["start"], 3), round(w["end"], 3)] for w in words if w["type"] == "word"]
open(os.path.join(film, "assets/audio/words2.js"), "w").write("window.__WORDS = " + json.dumps(words) + ";\n")
print(len(out), "replicas,", len(words), "words")
