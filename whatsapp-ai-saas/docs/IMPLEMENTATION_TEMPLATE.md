# Modèle d'Analyse d'Impact et de Roadmap

*(Ce modèle sera utilisé avant chaque changement complexe pour structurer l'implémentation et éviter les erreurs)*

## 1. Description du Besoin
- **Objectif :** (Résumé exhaustif de ce qui doit être accompli)
- **Contexte :** (Pourquoi ce besoin est pertinent et comment il s'intègre au projet global)

## 2. Découpage des Tâches (Liste Exhaustive)
- [ ] Tâche 1 : ...
- [ ] Tâche 2 : ...
- [ ] Tâche N : ...

*(L'agent ne s'arrêtera que lorsque l'ensemble de ces tâches sera accompli avec succès)*

## 3. Analyse d'Impact et Fichiers à Modifier
### [Composant / Module concerné]
#### [MODIFY] `chemin/absolu/vers/fichier`
- **Impact :** (Ce que la modification implique pour le reste de l'application)
- **Détail :** (Ce qui sera changé techniquement, en respectant la carte mentale du projet)

#### [NEW] `chemin/absolu/vers/nouveau_fichier`
- **Rôle :** (Objectif du nouveau fichier / composant)

## 4. Stratégie de Vérification Continue
- Relire en permanence le code modifié pour s'assurer de sa justesse (absence de fautes de frappe, logique correcte).
- Vérifier la compatibilité avec la `PROJECT_MENTAL_MAP.md`.
- Tests unitaires ou fonctionnels à réaliser avant de finaliser la phase.
