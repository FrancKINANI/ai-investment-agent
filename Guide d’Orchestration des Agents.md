**Guide d’Orchestration des Agents**  
Personal AI Investment Agent (v0.2)

Ce guide définit comment les agents spécialisés doivent collaborer de façon disciplinée, sûre et auditable.

---

### 1. Philosophie d’orchestration

- **Séparation stricte** : Research / Evolution d’un côté, Decision / Execution de l’autre.
- **Un seul point de synthèse** : le Decision Agent est le seul habilité à produire une décision finale.
- **Veto power** : le Risk Agent peut bloquer n’importe quelle proposition.
- **Pas d’exécution directe** par les agents de recherche ou le Supervisor.
- **Tout est journalisé** : chaque passage important doit pouvoir alimenter le Decision Journal et/ou le Strategy Lineage.
- **Fail-safe** : en cas de doute, d’information manquante ou de désaccord, on escalade vers l’owner plutôt que d’avancer.

---

### 2. Les Agents et leurs rôles dans le flux

| Agent                        | Rôle principal                              | Peut-il exécuter ? | Peut-il veto ? | Produit principal                  |
|-----------------------------|---------------------------------------------|--------------------|----------------|------------------------------------|
| Macro / Regime Agent        | Contexte de marché et régime                | Non                | Non            | Regime Brief                       |
| Strategy Researcher         | Variation et évolution des stratégies (AVO) | Non                | Non            | Strategy Proposal + Lineage update |
| Evaluator Agent             | Hard Gates + scoring multi-objectifs        | Non                | Non            | Evaluation Report                  |
| Risk Agent                  | Protection du capital                       | Non                | **Oui**        | Risk Assessment / Veto             |
| Supervisor (Meta)           | Observation de trajectoire long terme       | Non                | Non            | Trajectory Diagnosis + Recommendations |
| Decision Agent              | Synthèse finale et décision                 | Non (prépare seulement) | Non       | Decision Record (Journal)          |
| Execution (Sailor / CEX)    | Exécution réelle sous contraintes           | Oui (limité)       | —              | Transaction / Order result         |

---

### 3. Flux d’orchestration recommandés

#### A. Flux de Recherche / Évolution de Stratégie (le plus fréquent en Phase 1-2)

1. **Macro / Regime Agent** → produit le Regime Brief actuel.
2. **Strategy Researcher** → consulte le Strategy Lineage + Regime Brief → propose une variation.
3. **Evaluator Agent** → applique les Hard Evaluation Gates + scores.
4. **Risk Agent** → évalue le risque de la proposition (peut veto).
5. **Supervisor** (optionnel à ce stade) → observe si cette variation s’inscrit dans une bonne trajectoire.
6. **Decision Agent** → synthétise et décide :
   - Reject
   - Demander révision
   - Envoyer en simulation / paper trading
   - (Plus tard) proposer comme Live-Candidate
7. Mise à jour du **Strategy Lineage** et écriture éventuelle dans le Decision Journal.

#### B. Flux de Décision Live (une fois qu’une stratégie est validée)

1. **Macro / Regime Agent** → Regime Brief.
2. **Strategy Researcher** ou agent de signal → génère les signaux / propositions d’action concrets à partir des stratégies actives.
3. **Risk Agent** → contrôle final (sizing, concentration, limites actuelles).
4. **Decision Agent** → produit la Decision Record.
5. Si tout est vert et dans les mandates → envoi vers **Execution Layer** (Sailor ou CEX restreint).
6. **Outcome Tracker** + mise à jour du Decision Journal (partie résultat).

#### C. Flux de Supervision (périodique)

1. **Supervisor** analyse le Strategy Lineage + Decision Journal récents.
2. Produit un Trajectory Report.
3. Si problèmes détectés (stagnation, overfitting, angles morts) → recommandations structurées.
4. Les recommandations passent ensuite par le Decision Agent (et souvent validation owner en phase précoce).

---

### 4. Ordre d’appel standard (résumé pratique)

**Pour toute nouvelle idée de stratégie :**
```
Macro/Regime → Strategy Researcher → Evaluator → Risk → (Supervisor) → Decision Agent
```

**Pour une décision d’action concrète :**
```
Macro/Regime → (Signal/Strategy) → Risk → Decision Agent → Execution
```

**Règle d’or :**  
Risk Agent intervient **toujours avant** le Decision Agent.  
Supervisor n’intervient jamais dans le chemin critique d’exécution.

---

### 5. Standards de communication inter-agents

Tous les agents doivent communiquer avec des objets structurés (de préférence JSON) contenant au minimum :

- `from_agent`
- `to_agent` / `broadcast`
- `timestamp`
- `type` (RegimeBrief, StrategyProposal, EvaluationReport, RiskAssessment, TrajectoryReport, DecisionRecord…)
- `content` (le corps structuré)
- `confidence`
- `requires_approval` (true/false)
- `related_ids` (strategy_id, decision_id, etc.)

Le Decision Agent est responsable de rassembler ces objets pour construire le Decision Journal.

---

### 6. Règles de sécurité pendant l’orchestration

- Aucun agent de recherche ne peut parler directement à l’Execution Layer.
- Un Veto du Risk Agent est définitif pour le cycle en cours (il faut une nouvelle proposition).
- Toute promotion vers “Live-Candidate” ou exécution réelle exige que les Hard Gates soient Pass et que la simulation requise ait été faite.
- En cas de désaccord fort entre agents, le Decision Agent doit escalader vers l’owner plutôt que de trancher seul.
- Le Supervisor ne peut pas forcer une action ; il ne fait que recommander.

---

### 7. Recommandation d’implémentation technique

- Utilise **LangGraph** (ou équivalent) pour définir les graphes de flux ci-dessus.
- Garde des nœuds clairement séparés pour chaque agent spécialisé.
- Persiste tous les messages importants + Decision Journal + Strategy Lineage.
- Ajoute des nœuds de “Human Approval” aux endroits critiques (surtout en Phase 1 et 2).
- Logge l’ensemble du graphe d’exécution pour auditabilité.

---

### 8. Résumé ultra-court (à garder en tête)

1. Regime d’abord  
2. Variation / Proposition ensuite  
3. Evaluation Hard Gates  
4. Risk (veto possible)  
5. Décision finale  
6. Exécution seulement si tout est vert et autorisé  
7. Journal + Lineage toujours mis à jour  
8. Supervisor observe en fond et corrige la trajectoire sur le long terme
