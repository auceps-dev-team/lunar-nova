"""Transcription audio 100 % locale, via faster-whisper.

Aucun appel réseau vers un fournisseur LLM : le modèle tourne sur le CPU de la
machine. C'est la branche « local » de l'arbitrage A2 — plus lente qu'une API,
mais sans clé, sans coût par message, et l'audio ne quitte jamais le poste.

PROTOCOLE — stdin reçoit l'audio en base64, stdout rend un objet JSON et rien
d'autre. Toute trace de progression va sur stderr. C'est la même discipline que
le serveur MCP du projet : un stdout pollué casse l'appelant.

    {"text": "...", "language": "fr", "language_probability": 0.98,
     "duration": 12.3, "model": "small", "elapsed_ms": 4210}

En cas d'échec, stdout rend {"error": "...", "code": "..."} et le code de
sortie est non nul — jamais une transcription vide, qui se confondrait avec un
vocal sans parole.

PRÉREQUIS : pip install -r backend/scripts/requirements-whisper.txt
(versions épinglées : PyAV 19 casse faster-whisper 1.2.1 — voir ce fichier).
Lit l'Ogg/Opus de WhatsApp via PyAV : aucun binaire ffmpeg requis.

MESURÉ le 20/09/2026, poste de développement, même vocal de 10 s, CPU int8,
modèles en cache, deux essais chacun :
    tiny   16,4 à 44,7 s   instable ; « 10 micro » au lieu de « test micro »
    base   29,1 à 35,3 s   ouverture de phrase déformée
    small  26,9 à 27,8 s   transcription correcte, 2,7 × le temps réel
Chargement du modèle : 2,6 à 6 s. Le premier lancement télécharge le modèle
(~480 Mo pour small) dans le cache Hugging Face de l'utilisateur — d'où un
premier appel bien plus long, à ne pas confondre avec le coût courant.
"""

import sys
import os
import json
import base64
import tempfile
import time


def echec(code, message):
    json.dump({"error": message, "code": code}, sys.stdout, ensure_ascii=False)
    sys.stdout.flush()
    sys.exit(1)


def main():
    model_size = os.environ.get("WHISPER_MODEL", "small")
    # 'auto' laisse le modèle détecter ; sinon un code ISO 639-1 force la langue.
    langue = os.environ.get("WHISPER_LANGUAGE", "auto")
    device = os.environ.get("WHISPER_DEVICE", "cpu")
    compute = os.environ.get("WHISPER_COMPUTE", "int8")

    donnees = sys.stdin.buffer.read()
    if not donnees:
        echec("AUDIO_VIDE", "Aucun audio reçu sur stdin.")

    try:
        audio = base64.b64decode(donnees, validate=False)
    except Exception as exc:  # noqa: BLE001 — on veut le message brut
        echec("BASE64_INVALIDE", f"Base64 illisible : {exc}")

    if not audio:
        echec("AUDIO_VIDE", "Audio vide après décodage.")

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        echec(
            "MOTEUR_ABSENT",
            "faster-whisper n'est pas installé pour cet interpréteur Python. "
            "Installez-le avec : pip install faster-whisper",
        )

    # faster-whisper lit l'Ogg/Opus via PyAV : aucun binaire ffmpeg requis.
    fd, chemin = tempfile.mkstemp(suffix=".ogg")
    try:
        os.write(fd, audio)
        os.close(fd)

        debut = time.time()
        print(f"[whisper] chargement du modèle « {model_size} » ({device}/{compute})…", file=sys.stderr)
        modele = WhisperModel(model_size, device=device, compute_type=compute)
        print(f"[whisper] modèle prêt en {time.time() - debut:.1f}s", file=sys.stderr)

        t0 = time.time()
        segments, info = modele.transcribe(
            chemin,
            language=None if langue == "auto" else langue,
            vad_filter=True,
        )
        texte = "".join(s.text for s in segments).strip()
        ecoule = int((time.time() - t0) * 1000)
        print(f"[whisper] transcrit en {ecoule} ms", file=sys.stderr)

        json.dump(
            {
                "text": texte,
                "language": info.language,
                "language_probability": round(float(info.language_probability), 3),
                "duration": round(float(info.duration), 2),
                "model": model_size,
                "elapsed_ms": ecoule,
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.flush()
    except Exception as exc:  # noqa: BLE001
        # PyAV 19 a retiré un argument que faster-whisper 1.2.1 utilise encore :
        # l'erreur brute ne dirait rien à personne, on la traduit.
        if "metadata_errors" in str(exc):
            echec(
                "PYAV_INCOMPATIBLE",
                "Version de PyAV incompatible avec faster-whisper (PyAV 19 ou plus). "
                "Installez les versions épinglées : "
                "pip install -r backend/scripts/requirements-whisper.txt",
            )
        echec("TRANSCRIPTION_ECHOUEE", str(exc))
    finally:
        try:
            os.unlink(chemin)
        except OSError:
            pass


if __name__ == "__main__":
    main()
