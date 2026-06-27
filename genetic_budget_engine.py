"""
Genetic Budget Engine — Evolutionary FinOps for OtariGuard
===========================================================
Concept: Instead of a dumb hard $2 limit, this engine uses a Genetic Algorithm
to evolve the budget ceiling in real-time based on live traffic health signals.

How the GA works:
  - Each "chromosome" = a candidate budget ceiling (a float between $0.05 and $3.00)
  - Fitness function evaluates: threat ratio, CPU health, request legitimacy score
  - Each generation, the fittest chromosomes are selected and bred (crossover + mutation)
  - The winning genome becomes the new dynamic budget ceiling

Scenarios:
  - Legitimate high-traffic + system stress → budget expands up to $2.50 (survival mode)
  - DDoS / injection attack → budget collapses to $0.05 (AI starvation / attacker starved)
  - Normal ops → budget stays near $2.00 baseline
"""

import random
import math
import time
from dataclasses import dataclass, field
from typing import List

# ─── Configuration ────────────────────────────────────────────────────────────
POPULATION_SIZE = 12       # Number of candidate budget "genomes" per generation
GENERATIONS = 6            # How many evolution cycles per decision tick
MUTATION_RATE = 0.25       # Probability of mutating a gene
CROSSOVER_RATE = 0.70      # Probability of crossover between two parents
BUDGET_MIN = 0.05          # Absolute floor — AI starvation mode
BUDGET_MAX = 3.00          # Absolute ceiling — emergency expansion cap
BUDGET_BASELINE = 2.00     # Default hard limit

# ─── Data Structures ──────────────────────────────────────────────────────────
@dataclass
class TrafficDNA:
    """Live infrastructure health signals — the 'environment' the GA adapts to."""
    threat_ratio: float        # 0.0 to 1.0 — fraction of recent logs that were threats
    cpu_usage: float           # 0.0 to 1.0 — normalized CPU load
    request_rate: float        # 0.0 to 1.0 — normalized legitimate request rate
    system_health: float       # 0.0 to 1.0 — overall health score (1=perfect, 0=dying)
    is_ddos_pattern: bool      # True if high-volume malicious traffic detected
    is_critical_load: bool     # True if CPU > 85% AND requests are legitimate


@dataclass
class BudgetGenome:
    """A single chromosome — one candidate budget ceiling value."""
    ceiling: float             # The candidate budget ceiling in dollars
    fitness: float = 0.0       # Computed fitness score (higher = better adapted)

    def mutate(self):
        """Randomly mutate the genome by a small delta."""
        if random.random() < MUTATION_RATE:
            delta = random.gauss(0, 0.15)  # Small gaussian mutation
            self.ceiling = max(BUDGET_MIN, min(BUDGET_MAX, self.ceiling + delta))

    @staticmethod
    def crossover(parent_a: 'BudgetGenome', parent_b: 'BudgetGenome') -> 'BudgetGenome':
        """Blend crossover — child inherits weighted average of both parents."""
        if random.random() < CROSSOVER_RATE:
            alpha = random.random()
            child_ceiling = alpha * parent_a.ceiling + (1 - alpha) * parent_b.ceiling
        else:
            # No crossover — clone the fitter parent
            child_ceiling = parent_a.ceiling if parent_a.fitness >= parent_b.fitness else parent_b.ceiling
        return BudgetGenome(ceiling=max(BUDGET_MIN, min(BUDGET_MAX, child_ceiling)))


# ─── Core Fitness Function ─────────────────────────────────────────────────────
def evaluate_fitness(genome: BudgetGenome, dna: TrafficDNA) -> float:
    """
    Core of the GA — assigns a fitness score to a candidate budget ceiling.
    
    Design principle:
      - DDoS attack → low ceilings score highest (starvation is GOOD)
      - Critical legitimate load → higher ceilings score highest (survival is GOOD)
      - Normal traffic → ceiling near baseline scores highest (stability is GOOD)
    """
    ceiling = genome.ceiling
    score = 0.0

    if dna.is_ddos_pattern:
        # ── DDoS Scenario: Reward genomes that MINIMIZE the budget ceiling ──
        # Fitness peaks at $0.05 and drops sharply as ceiling rises
        score = 100.0 * math.exp(-5.0 * (ceiling - BUDGET_MIN))
        # Extra penalty for any genome above $0.50 during active DDoS
        if ceiling > 0.50:
            score *= 0.1

    elif dna.is_critical_load:
        # ── Critical Legitimate Load: Reward genomes that EXPAND the budget ──
        # Fitness peaks at $2.50 — controlled expansion, not unlimited
        target = 2.50
        score = 100.0 * math.exp(-3.0 * abs(ceiling - target))
        # Penalize genomes that would freeze the system at $2.00
        if ceiling < BUDGET_BASELINE:
            score *= 0.4

    else:
        # ── Normal Operations: Reward genomes near the $2.00 baseline ──
        # Soft bell curve centered at BUDGET_BASELINE
        score = 100.0 * math.exp(-4.0 * (ceiling - BUDGET_BASELINE) ** 2)
        # Penalize both directions — too loose or too tight
        threat_penalty = dna.threat_ratio * 40.0
        health_bonus = dna.system_health * 15.0
        score = score - threat_penalty + health_bonus

    return max(0.0, score)


# ─── Genetic Algorithm Engine ─────────────────────────────────────────────────
class GeneticBudgetEngine:
    """
    The Evolutionary FinOps Engine.
    Runs a micro-GA on each tick to produce an optimally adapted budget ceiling.
    """

    def __init__(self):
        self.current_ceiling = BUDGET_BASELINE
        self.generation_count = 0
        self.last_dna: TrafficDNA = None
        self.evolution_log: List[dict] = []  # History for UI display
        self.population: List[BudgetGenome] = self._seed_population()

    def _seed_population(self) -> List[BudgetGenome]:
        """Initialize a diverse starting population around the baseline."""
        pop = []
        # Always seed with a few near-baseline genomes for stability
        for _ in range(POPULATION_SIZE // 3):
            pop.append(BudgetGenome(ceiling=BUDGET_BASELINE + random.gauss(0, 0.1)))
        # Seed the rest randomly across the valid range
        for _ in range(POPULATION_SIZE - len(pop)):
            pop.append(BudgetGenome(ceiling=random.uniform(BUDGET_MIN, BUDGET_MAX)))
        return pop

    def _select_parents(self) -> tuple:
        """Tournament selection — pick the fitter of two random candidates."""
        def tournament():
            a, b = random.sample(self.population, 2)
            return a if a.fitness >= b.fitness else b
        return tournament(), tournament()

    def _evolve(self, dna: TrafficDNA) -> float:
        """
        Run one full GA cycle and return the evolved optimal budget ceiling.
        """
        # Step 1 — Evaluate fitness for the current environment (TrafficDNA)
        for genome in self.population:
            genome.fitness = evaluate_fitness(genome, dna)

        # Step 2 — Sort by fitness (best first)
        self.population.sort(key=lambda g: g.fitness, reverse=True)

        # Step 3 — Elitism: keep top 2 genomes unchanged
        new_population = [
            BudgetGenome(ceiling=self.population[0].ceiling),
            BudgetGenome(ceiling=self.population[1].ceiling),
        ]

        # Step 4 — Breed the rest via crossover + mutation
        while len(new_population) < POPULATION_SIZE:
            parent_a, parent_b = self._select_parents()
            child = BudgetGenome.crossover(parent_a, parent_b)
            child.mutate()
            new_population.append(child)

        self.population = new_population
        self.generation_count += 1

        # The fittest genome's ceiling is the evolved answer
        return self.population[0].ceiling

    def tick(self, dna: TrafficDNA) -> dict:
        """
        Main entry point. Feed in live TrafficDNA, get back the evolved budget decision.
        
        Returns a dict with all data needed for the telemetry dashboard.
        """
        self.last_dna = dna

        # Run multiple generations per tick for stronger convergence
        best_ceiling = self.current_ceiling
        for _ in range(GENERATIONS):
            best_ceiling = self._evolve(dna)

        prev_ceiling = self.current_ceiling
        self.current_ceiling = round(best_ceiling, 4)

        # Determine the mode label for the UI
        if dna.is_ddos_pattern:
            mode = "AI_STARVATION"
            color = "rose"
            reason = "DDoS pattern detected — budget collapsed to starve attacker"
        elif dna.is_critical_load:
            mode = "SURVIVAL_EXPANSION"
            color = "cyan"
            reason = "Critical legitimate load — budget expanded for system survival"
        elif dna.threat_ratio > 0.4:
            mode = "THREAT_CONTRACTION"
            color = "yellow"
            reason = f"High threat ratio ({dna.threat_ratio:.0%}) — budget tightened"
        else:
            mode = "STABLE_BASELINE"
            color = "green"
            reason = "Normal operations — budget at evolved baseline"

        delta = self.current_ceiling - prev_ceiling
        
        result = {
            "ceiling": self.current_ceiling,
            "prev_ceiling": round(prev_ceiling, 4),
            "delta": round(delta, 4),
            "mode": mode,
            "color": color,
            "reason": reason,
            "generation": self.generation_count,
            "fitness_best": round(self.population[0].fitness, 2),
            "fitness_avg": round(sum(g.fitness for g in self.population) / len(self.population), 2),
            "dna": {
                "threatRatio": round(dna.threat_ratio, 3),
                "cpuUsage": round(dna.cpu_usage, 3),
                "systemHealth": round(dna.system_health, 3),
                "isDDoS": dna.is_ddos_pattern,
                "isCritical": dna.is_critical_load,
            },
            "timestamp": time.time()
        }

        # Keep a rolling log for UI history panel
        self.evolution_log.append(result)
        if len(self.evolution_log) > 20:
            self.evolution_log.pop(0)

        return result


# ─── Helper: Build TrafficDNA from live telemetry signals ────────────────────
def build_traffic_dna(
    threat_count: int,
    total_count: int,
    cpu_percent: float,
    recent_injection_burst: bool = False
) -> TrafficDNA:
    """
    Converts raw telemetry numbers into a normalized TrafficDNA struct.
    
    Args:
        threat_count: Number of threat events in the recent window
        total_count: Total events in the recent window
        cpu_percent: CPU usage 0-100
        recent_injection_burst: True if 3+ injections happened in last 10 seconds
    """
    threat_ratio = threat_count / max(total_count, 1)
    cpu_usage = cpu_percent / 100.0
    # Legitimate request rate inversely related to threat ratio
    request_rate = max(0.0, (1.0 - threat_ratio) * (1.0 - max(0, cpu_usage - 0.85)))
    system_health = max(0.0, 1.0 - (threat_ratio * 0.6 + max(0, cpu_usage - 0.7) * 0.4))

    # DDoS: burst of injections OR high threat ratio with high volume
    is_ddos = recent_injection_burst or (threat_ratio > 0.6 and total_count > 5)
    # Critical: CPU > 85% but traffic is mostly legitimate
    is_critical = cpu_usage > 0.85 and threat_ratio < 0.2

    return TrafficDNA(
        threat_ratio=threat_ratio,
        cpu_usage=cpu_usage,
        request_rate=request_rate,
        system_health=system_health,
        is_ddos_pattern=is_ddos,
        is_critical_load=is_critical
    )
