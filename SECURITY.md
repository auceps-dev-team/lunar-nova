# Politique de sécurité

## Signaler une vulnérabilité

**N'ouvrez pas d'issue publique pour une faille de sécurité.**

Écrivez à **dev.team@auceps-digital.agency** en décrivant :

- le comportement observé et son impact ;
- les étapes pour le reproduire ;
- la version de WaCopilote concernée (visible dans les Réglages).

Nous accusons réception sous 72 heures ouvrées et vous tenons informé du
correctif. Si vous le souhaitez, votre nom sera mentionné dans les notes de
version.

## Versions supportées

Seule la dernière version mineure reçoit des correctifs de sécurité. WaCopilote
se met à jour automatiquement via GitHub Releases.

## Modèle de menace

WaCopilote est une application de bureau : **il n'existe aucun serveur WaCopilote
qui reçoive vos données**. Vos conversations, contacts et clés d'API restent sur
votre machine. Les seules données qui la quittent sont les requêtes que vous
adressez explicitement aux fournisseurs d'IA que vous avez configurés
(Google Gemini, NVIDIA NIM, OpenRouter, Together AI) — ou aucune, si vous
utilisez uniquement Ollama en local.

Ce que nous protégeons, et comment :

| Risque | Protection |
|---|---|
| Lecture de l'API locale depuis le réseau | Le backend n'écoute que sur `127.0.0.1` |
| Lecture de l'API locale par un autre programme de la machine | Token d'authentification requis sur toutes les routes |
| Vol de la base par copie de fichier | Secrets chiffrés en AES-256-GCM, clé maître scellée par le magasin du système |
| Exfiltration via le renderer | `contextIsolation` activé, `nodeIntegration` désactivé, passerelle IPC restreinte |
| Écriture non désirée sur un site WordPress | L'agent IA ne peut que proposer ; l'exécution exige une approbation humaine |

Les limites connues sont documentées dans la section Sécurité du
[README](whatsapp-ai-saas/README.md#-sécurité--audit-de-protection).

## Données présentes dans l'historique Git

Avant l'ouverture du code, ce dépôt était privé et contenait des fichiers de
travail issus du développement des modules de prospection. Parmi eux,
`backend/temp_page.html` et `annuaireci_dump.html` : des captures de pages
d'annuaires professionnels en ligne, incluant les coordonnées de quelques
entreprises (14 numéros de téléphone et 4 adresses e-mail).

Ces fichiers ont été **retirés du dépôt en v1.38.1**. Ils restent toutefois
accessibles dans l'historique Git, que nous avons choisi de ne pas réécrire :

- il s'agit de coordonnées **professionnelles**, publiées par les entreprises
  concernées sur des annuaires publics, donc déjà accessibles à leur source ;
- réécrire l'historique invaliderait toutes les copies et forks existants, pour
  un bénéfice réel limité une fois le dépôt public ;
- le volume est faible et circonscrit à deux fichiers identifiés.

**Si vous êtes concerné et souhaitez la suppression de vos données**, écrivez à
**dev.team@auceps-digital.agency**. Nous procéderons alors à une réécriture
ciblée de l'historique.

## Utiliser WaCopilote de façon responsable

Les modules d'automatisation WhatsApp et de prospection manipulent des données
de tiers. Deux rappels :

- **L'automatisation de WhatsApp Web contrevient aux conditions d'utilisation de
  WhatsApp** et peut entraîner la restriction ou le blocage de votre compte. Vous
  utilisez ces fonctionnalités à vos propres risques.
- **Les données extraites des annuaires sont des données à caractère personnel**
  au sens du RGPD dès lors qu'elles identifient une personne physique. Leur
  usage à des fins de prospection vous impose des obligations : base légale,
  information des personnes et droit d'opposition. Le logiciel ne s'en acquitte
  pas à votre place.
