"""Prépare la prod pour les règles v5 (appareils enregistrés).

Usage : python scripts/prod-security-setup.py [--strip-menu-pin]
  - security/policy  {enforce:false}       (créé seulement s'il n'existe pas)
  - security/enroll  {code:<aléatoire>}    (créé seulement s'il n'existe pas ;
                     le code est écrit dans CODE-ENREGISTREMENT-APPAREILS.txt,
                     HORS du dépôt git, jamais affiché)
  - config/staffcfg  {serveurPin}          (copie de config/menu.serveurPin)
  - --strip-menu-pin : retire serveurPin de config/menu (doc public)
Accès : refresh token firebase-tools (compte propriétaire, contourne les règles).
"""
import json, os, secrets, sys, time, urllib.request, urllib.parse

PROJ = "la-marmitte-express"
UA = {"User-Agent": "Mozilla/5.0"}
CODE_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "CODE-ENREGISTREMENT-APPAREILS.txt"))

cfg = json.load(open(os.path.expanduser("~/.config/configstore/firebase-tools.json")))
data = urllib.parse.urlencode({"refresh_token": cfg["tokens"]["refresh_token"],
    "client_id": "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
    "client_secret": "j9iVZfS8kkCEFUPaAeJV0sAi", "grant_type": "refresh_token"}).encode()
tok = json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=data, headers=UA)))["access_token"]
H = {**UA, "Authorization": "Bearer " + tok, "Content-Type": "application/json"}
BASE = f"https://firestore.googleapis.com/v1/projects/{PROJ}/databases/(default)/documents"

def req(method, url, body=None):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None, headers=H, method=method)
    try:
        return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise RuntimeError(f"{method} {url} -> {e.code} {e.read().decode()[:200]}")

def create_if_missing(path, fields):
    if req("GET", f"{BASE}/{path}") is not None:
        print(f"= {path} existe déjà (inchangé)")
        return False
    req("PATCH", f"{BASE}/{path}?currentDocument.exists=false", {"fields": fields})
    print(f"+ {path} créé")
    return True

# 1. Politique : protection désactivée (transition)
create_if_missing("security/policy", {"enforce": {"booleanValue": False}, "updatedAt": {"integerValue": str(int(time.time()*1000))}})

# 2. Code d'enregistrement
alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
code = "-".join("".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3))
if create_if_missing("security/enroll", {"code": {"stringValue": code}}):
    with open(CODE_FILE, "w", encoding="utf-8") as f:
        f.write("CODE D'ENREGISTREMENT DES APPAREILS — La Marmite Express\n\n"
                f"    {code}\n\n"
                "À saisir UNE fois sur chaque appareil du resto (caisse, cuisine, téléphones serveuses)\n"
                "quand le bandeau « Appareil non enregistré » apparaît.\n"
                "Changeable dans la caisse : Admin → Paramètres → Sécurité des appareils.\n"
                f"Créé le {time.strftime('%Y-%m-%d %H:%M')}\n")
    print(f"  code écrit dans {CODE_FILE}")

# 3. PIN serveur → config/staffcfg
menu = req("GET", f"{BASE}/config/menu") or {}
pin = (menu.get("fields", {}).get("serveurPin", {}) or {}).get("stringValue")
if pin is not None:
    if req("GET", f"{BASE}/config/staffcfg") is None:
        req("PATCH", f"{BASE}/config/staffcfg", {"fields": {"serveurPin": {"stringValue": pin}, "updatedAt": {"integerValue": str(int(time.time()*1000))}}})
        print("+ config/staffcfg créé (PIN serveur copié)")
    else:
        print("= config/staffcfg existe déjà")
else:
    print("= pas de serveurPin dans config/menu")

# 4. Retrait du PIN du doc public
if "--strip-menu-pin" in sys.argv and pin is not None:
    req("PATCH", f"{BASE}/config/menu?updateMask.fieldPaths=serveurPin", {"fields": {}})
    print("- serveurPin retiré de config/menu")

print("settings.mailWorkerUrl configuré :", bool((((menu.get("fields", {}).get("settings", {}) or {}).get("mapValue", {}) or {}).get("fields", {}) or {}).get("mailWorkerUrl", {}).get("stringValue")))
