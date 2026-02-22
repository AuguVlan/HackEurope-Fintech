"""
Synthetic Dataset Generator — 500 Gig Workers
===============================================

Generates realistic worker profiles with:
- 12–24 months of earnings history
- 12–25 advance repayments (all eligible)
- Monthly expenses
- Computed risk features for CatBoost

Archetypes:
  Rock Solid (175)  — stable income, 95–100% on-time
  Good Volatile (150) — swinging income, 85–95% on-time
  Stretched Thin (100) — low income, high expenses, 70–85% on-time
  Red Flags (75) — declining, 1–2 defaults, <70% on-time

Usage:
    python3 -m ingestion.generate
    python3 ingestion/generate.py
    python3 ingestion/generate.py --workers 500 --seed 42
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import random
import statistics
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


# ── Constants ─────────────────────────────────────────────────────────

HERE     = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")

# Single platform for all workers
PLATFORM = "GigExpress"

# Two countries — roughly 50/50 split
COUNTRIES = {
    "DE": {"currency": "EUR", "label": "Germany"},
    "TR": {"currency": "TRY", "label": "Turkey"},
}
COUNTRY_LIST = list(COUNTRIES.keys())  # ["DE", "TR"]

# German names (for DE workers)
DE_FIRST_NAMES = [
    "Lukas", "Leon", "Finn", "Jonas", "Felix", "Noah", "Elias", "Paul",
    "Maximilian", "Ben", "Niklas", "Tim", "Moritz", "Jan", "Philipp",
    "Julian", "Alexander", "David", "Sebastian", "Tobias", "Stefan",
    "Thomas", "Michael", "Andreas", "Christian", "Markus", "Daniel",
    "Hannah", "Emma", "Mia", "Sophia", "Lena", "Anna", "Laura",
    "Lea", "Marie", "Johanna", "Katharina", "Julia", "Lisa", "Sarah",
    "Clara", "Amelie", "Frieda", "Charlotte", "Ida", "Greta", "Nora",
    "Helena", "Franziska", "Marlene", "Louisa", "Theresa", "Eva", "Sabine",
]

DE_LAST_NAMES = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer",
    "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch",
    "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann",
    "Schwarz", "Zimmermann", "Braun", "Krüger", "Hofmann", "Hartmann",
    "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier",
    "Lehmann", "Schmid", "Schulze", "Maier", "Köhler", "Herrmann",
    "König", "Walter", "Mayer", "Huber", "Kaiser", "Fuchs",
]

# Turkish names (for TR workers)
TR_FIRST_NAMES = [
    "Mehmet", "Ahmet", "Mustafa", "Ali", "Hüseyin", "Hasan", "İbrahim",
    "Ömer", "Yusuf", "Murat", "Emre", "Burak", "Serkan", "Oğuz", "Cem",
    "Tuncay", "Selim", "Kemal", "Erkan", "Barış", "Fatih", "Tolga", "Uğur",
    "Deniz", "Can", "Onur", "Volkan", "Tarık", "Engin", "Koray",
    "Ayşe", "Fatma", "Emine", "Hatice", "Zeynep", "Elif", "Merve",
    "Büşra", "Esra", "Nur", "Seda", "Gül", "Derya", "Özlem", "Sibel",
    "Ceren", "Pınar", "Gamze", "Tuğba", "Aslı", "Dilek", "Sevgi",
    "Leyla", "Melek", "Naz", "Ece", "Defne", "Selin", "Beren", "İlknur",
]

TR_LAST_NAMES = [
    "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Öztürk",
    "Aydın", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Koç",
    "Kurt", "Özdemir", "Polat", "Erdoğan", "Aksoy", "Güneş",
    "Korkmaz", "Yalçın", "Aktaş", "Taş", "Bayrak", "Kaplan", "Bulut",
    "Ünal", "Acar", "Tekin", "Güler", "Balcı", "Şen", "Karaca",
    "Tunç", "Başaran", "Gündüz", "Ateş", "Kara", "Toprak",
]

# Mapping: country → name pools
NAMES_BY_COUNTRY = {
    "DE": (DE_FIRST_NAMES, DE_LAST_NAMES),
    "TR": (TR_FIRST_NAMES, TR_LAST_NAMES),
}


# ── Enums ─────────────────────────────────────────────────────────────

class Archetype(Enum):
    ROCK_SOLID    = "rock_solid"
    GOOD_VOLATILE = "good_volatile"
    STRETCHED     = "stretched_thin"
    RED_FLAGS     = "red_flags"


class RepaymentStatus(Enum):
    REPAID_ON_TIME = "repaid_on_time"
    REPAID_LATE    = "repaid_late"
    DEFAULTED      = "defaulted"


class IncomeState(Enum):
    FEAST  = "FEAST"
    NORMAL = "NORMAL"
    FAMINE = "FAMINE"


# ── Data Classes ──────────────────────────────────────────────────────

@dataclass
class MonthlyEarning:
    worker_id: str
    month: str
    gross_earning: float
    platform_fees: float
    net_earning: float
    currency: str = "EUR"
    prev_month_net: float = 0.0          # previous month's net (for continuity)
    country: str = "DE"


@dataclass
class MonthlyExpense:
    worker_id: str
    month: str
    rent: float
    transport: float
    food: float
    insurance: float
    total: float


@dataclass
class AdvanceRepayment:
    advance_id: str
    worker_id: str
    amount: float
    date_issued: str
    date_due: str
    date_repaid: Optional[str]
    status: str
    days_late: int


@dataclass
class WorkerProfile:
    worker_id: str
    name: str
    email: str
    platform: str
    country: str                       # DE or TR
    currency: str                      # EUR or TRY
    registration_date: str
    archetype: str
    months_active: int
    earnings: List[MonthlyEarning] = field(default_factory=list)
    expenses: List[MonthlyExpense] = field(default_factory=list)
    repayments: List[AdvanceRepayment] = field(default_factory=list)
    avg_wage: float = 0.0
    income_volatility: float = 0.0
    income_state: str = "NORMAL"
    debt_to_income: float = 0.0
    repayment_count: int = 0
    on_time_rate: float = 0.0
    avg_days_late: float = 0.0
    default_count: int = 0
    disposable_income: float = 0.0


# ── Archetype Configs ─────────────────────────────────────────────────

@dataclass
class ArchetypeConfig:
    name: Archetype
    count: int
    earning_range: Tuple[float, float]
    volatility: Tuple[float, float]
    months_range: Tuple[int, int]
    repayment_range: Tuple[int, int]
    on_time_prob: Tuple[float, float]
    default_prob: float
    expense_ratio: Tuple[float, float]
    trend: Tuple[float, float]


ARCHETYPES: List[ArchetypeConfig] = [
    ArchetypeConfig(
        name=Archetype.ROCK_SOLID, count=175,
        earning_range=(1500.0, 3000.0), volatility=(0.03, 0.10),
        months_range=(18, 24), repayment_range=(18, 25),
        on_time_prob=(0.95, 1.0), default_prob=0.0,
        expense_ratio=(0.45, 0.65), trend=(1.0, 1.01),
    ),
    ArchetypeConfig(
        name=Archetype.GOOD_VOLATILE, count=150,
        earning_range=(800.0, 5000.0), volatility=(0.20, 0.40),
        months_range=(14, 22), repayment_range=(14, 20),
        on_time_prob=(0.85, 0.95), default_prob=0.0,
        expense_ratio=(0.50, 0.70), trend=(0.99, 1.02),
    ),
    ArchetypeConfig(
        name=Archetype.STRETCHED, count=100,
        earning_range=(900.0, 1800.0), volatility=(0.10, 0.25),
        months_range=(12, 18), repayment_range=(12, 16),
        on_time_prob=(0.70, 0.85), default_prob=0.0,
        expense_ratio=(0.75, 0.92), trend=(0.98, 1.0),
    ),
    ArchetypeConfig(
        name=Archetype.RED_FLAGS, count=75,
        earning_range=(600.0, 2200.0), volatility=(0.25, 0.50),
        months_range=(12, 16), repayment_range=(12, 14),
        on_time_prob=(0.50, 0.70), default_prob=0.12,
        expense_ratio=(0.80, 0.95), trend=(0.94, 0.98),
    ),
]


# ── Generator Class ───────────────────────────────────────────────────

class WorkerDatasetGenerator:
    """Generates reproducible synthetic dataset of gig workers."""

    def __init__(self, total_workers: int = 500, seed: int = 42):
        self.total_workers = total_workers
        self.seed = seed
        self.rng = random.Random(seed)
        self.workers: List[WorkerProfile] = []
        self._advance_counter = 0

        base_total = sum(a.count for a in ARCHETYPES)
        self.archetype_counts = []
        remaining = total_workers
        for i, a in enumerate(ARCHETYPES):
            if i == len(ARCHETYPES) - 1:
                self.archetype_counts.append(remaining)
            else:
                n = round(a.count / base_total * total_workers)
                self.archetype_counts.append(n)
                remaining -= n

    def _make_identity(self, idx: int) -> Tuple[str, str, str, str, str, str]:
        worker_id = f"WRK-{idx:06d}"
        country = self.rng.choice(COUNTRY_LIST)  # ~50/50 DE or TR
        currency = COUNTRIES[country]["currency"]
        firsts, lasts = NAMES_BY_COUNTRY[country]
        first = self.rng.choice(firsts)
        last = self.rng.choice(lasts)
        name = f"{first} {last}"
        email = f"{first.lower()}.{last.lower()}@{'gmail' if self.rng.random() > 0.4 else 'outlook'}.com"
        # Normalise special chars for email
        for old, new in [("ü", "u"), ("ö", "o"), ("ş", "s"), ("ç", "c"), ("ğ", "g"),
                         ("ı", "i"), ("İ", "i"), ("ä", "a"), (" ", ""), ("'", "")]:
            email = email.replace(old, new)
        days_ago = self.rng.randint(365, 365 * 3)
        reg_date = (datetime(2026, 2, 22) - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        return worker_id, name, email, reg_date, country, currency

    def _generate_earnings(self, worker_id: str, cfg: ArchetypeConfig, n_months: int, currency: str, country: str) -> List[MonthlyEarning]:
        """Autoregressive earnings: each month = f(previous month) + noise.
        
        This gives month-to-month continuity instead of i.i.d. random draws.
        prev_net carries forward so the risk model can see the trajectory.
        """
        base = self.rng.uniform(*cfg.earning_range)
        vol_frac = self.rng.uniform(*cfg.volatility)
        vol = base * vol_frac
        trend = self.rng.uniform(*cfg.trend)
        momentum = 0.7  # how much previous month influences next (0=none, 1=full)
        fee_rate = self.rng.uniform(0.08, 0.15)  # fixed per worker (same contract)

        records: List[MonthlyEarning] = []
        ref = datetime(2026, 2, 1)
        prev_gross = base  # seed with baseline

        for i in range(n_months):
            month_dt = ref - timedelta(days=30 * (n_months - 1 - i))
            month_str = month_dt.strftime("%Y-%m")

            # Autoregressive: blend previous month with trend + noise
            target = base * (trend ** i)
            noise = self.rng.gauss(0, vol)
            gross = momentum * prev_gross + (1 - momentum) * target + noise
            gross = round(max(50.0, gross), 2)

            fees = round(gross * fee_rate, 2)
            net = round(gross - fees, 2)
            prev_net = records[-1].net_earning if records else 0.0

            records.append(MonthlyEarning(
                worker_id=worker_id, month=month_str,
                gross_earning=gross, platform_fees=fees,
                net_earning=net, currency=currency,
                prev_month_net=prev_net, country=country,
            ))
            prev_gross = gross  # carry forward

        return records

    def _generate_expenses(self, worker_id: str, earnings: List[MonthlyEarning], cfg: ArchetypeConfig) -> List[MonthlyExpense]:
        avg_net = statistics.mean(e.net_earning for e in earnings) if earnings else 1000.0
        expense_ratio = self.rng.uniform(*cfg.expense_ratio)
        total_budget = avg_net * expense_ratio
        rent_frac = self.rng.uniform(0.35, 0.50)
        food_frac = self.rng.uniform(0.20, 0.30)
        transport_frac = self.rng.uniform(0.08, 0.15)
        insurance_frac = 1.0 - rent_frac - food_frac - transport_frac
        records: List[MonthlyExpense] = []
        for e in earnings:
            noise = self.rng.uniform(0.92, 1.08)
            total = total_budget * noise
            rent = round(total * rent_frac, 2)
            food = round(total * food_frac, 2)
            transport = round(total * transport_frac, 2)
            insurance = round(total * insurance_frac, 2)
            actual_total = round(rent + food + transport + insurance, 2)
            records.append(MonthlyExpense(
                worker_id=worker_id, month=e.month,
                rent=rent, transport=transport, food=food,
                insurance=insurance, total=actual_total,
            ))
        return records

    def _generate_repayments(self, worker_id: str, cfg: ArchetypeConfig, avg_net: float, n_months: int) -> List[AdvanceRepayment]:
        n_repayments = self.rng.randint(*cfg.repayment_range)
        on_time_prob = self.rng.uniform(*cfg.on_time_prob)
        records: List[AdvanceRepayment] = []
        ref = datetime(2026, 2, 22)
        for i in range(n_repayments):
            self._advance_counter += 1
            adv_id = f"ADV-{self._advance_counter:06d}"
            amount = round(self.rng.uniform(0.15, 0.40) * avg_net, 2)
            days_back = int((n_repayments - i) / n_repayments * n_months * 30)
            issued = ref - timedelta(days=days_back + self.rng.randint(0, 15))
            due = issued + timedelta(days=30)
            roll = self.rng.random()
            if roll < cfg.default_prob:
                status = RepaymentStatus.DEFAULTED
                days_late = self.rng.randint(31, 90)
                repaid_date = None
            elif roll < cfg.default_prob + (1 - on_time_prob):
                status = RepaymentStatus.REPAID_LATE
                days_late = self.rng.randint(1, 30)
                repaid_date = (due + timedelta(days=days_late)).strftime("%Y-%m-%d")
            else:
                status = RepaymentStatus.REPAID_ON_TIME
                days_late = 0
                early = self.rng.randint(0, 5)
                repaid_date = (due - timedelta(days=early)).strftime("%Y-%m-%d")
            records.append(AdvanceRepayment(
                advance_id=adv_id, worker_id=worker_id,
                amount=amount, date_issued=issued.strftime("%Y-%m-%d"),
                date_due=due.strftime("%Y-%m-%d"), date_repaid=repaid_date,
                status=status.value, days_late=days_late,
            ))
        return records

    def _compute_risk_features(self, worker: WorkerProfile) -> None:
        nets = [e.net_earning for e in worker.earnings]
        worker.avg_wage = round(statistics.mean(nets), 2) if nets else 0.0
        worker.income_volatility = round(statistics.stdev(nets), 2) if len(nets) > 1 else 0.0
        delta = 50.0
        if nets:
            latest = nets[-1]
            if latest > worker.avg_wage + delta:
                worker.income_state = IncomeState.FEAST.value
            elif latest < worker.avg_wage - delta:
                worker.income_state = IncomeState.FAMINE.value
            else:
                worker.income_state = IncomeState.NORMAL.value
        worker.repayment_count = len(worker.repayments)
        on_time = sum(1 for r in worker.repayments if r.status == RepaymentStatus.REPAID_ON_TIME.value)
        worker.on_time_rate = round(on_time / worker.repayment_count, 4) if worker.repayment_count else 0.0
        worker.default_count = sum(1 for r in worker.repayments if r.status == RepaymentStatus.DEFAULTED.value)
        late_days = [r.days_late for r in worker.repayments if r.days_late > 0]
        worker.avg_days_late = round(statistics.mean(late_days), 2) if late_days else 0.0
        outstanding = sum(r.amount for r in worker.repayments if r.status == RepaymentStatus.DEFAULTED.value)
        worker.debt_to_income = round(outstanding / worker.avg_wage, 4) if worker.avg_wage > 0 else 0.0
        avg_expense = statistics.mean(e.total for e in worker.expenses) if worker.expenses else 0.0
        worker.disposable_income = round(worker.avg_wage - avg_expense, 2)
        reg = datetime.strptime(worker.registration_date, "%Y-%m-%d")
        worker.months_active = max(1, (datetime(2026, 2, 22) - reg).days // 30)

    def generate(self) -> List[WorkerProfile]:
        idx = 0
        for arch_cfg, count in zip(ARCHETYPES, self.archetype_counts):
            for _ in range(count):
                idx += 1
                wid, name, email, reg, country, currency = self._make_identity(idx)
                n_months = self.rng.randint(*arch_cfg.months_range)
                earnings = self._generate_earnings(wid, arch_cfg, n_months, currency, country)
                expenses = self._generate_expenses(wid, earnings, arch_cfg)
                avg_net = statistics.mean(e.net_earning for e in earnings) if earnings else 1000.0
                repayments = self._generate_repayments(wid, arch_cfg, avg_net, n_months)
                worker = WorkerProfile(
                    worker_id=wid, name=name, email=email,
                    platform=PLATFORM,
                    country=country,
                    currency=currency,
                    registration_date=reg, archetype=arch_cfg.name.value,
                    months_active=n_months, earnings=earnings,
                    expenses=expenses,
                    repayments=repayments,
                )
                self._compute_risk_features(worker)
                self.workers.append(worker)
        return self.workers


# ── Export Functions ───────────────────────────────────────────────────

class DatasetExporter:
    """Writes generated workers to JSON + CSV files."""

    def __init__(self, workers: List[WorkerProfile], data_dir: str = DATA_DIR):
        self.workers = workers
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)

    def export_all(self) -> Dict[str, str]:
        paths = {}
        paths["json"]       = self._write_json()
        paths["csv"]        = self._write_flat_csv()
        paths["earnings"]   = self._write_earnings_csv()
        paths["repayments"] = self._write_repayments_csv()
        paths["expenses"]   = self._write_expenses_csv()
        return paths

    def _write_json(self) -> str:
        path = os.path.join(self.data_dir, "workers_500.json")
        data = []
        for w in self.workers:
            d = {
                "worker_id": w.worker_id, "name": w.name, "email": w.email,
                "platform": w.platform,
                "country": w.country,
                "currency": w.currency,
                "registration_date": w.registration_date, "archetype": w.archetype,
                "months_active": w.months_active, "avg_wage": w.avg_wage,
                "income_volatility": w.income_volatility, "income_state": w.income_state,
                "debt_to_income": w.debt_to_income, "repayment_count": w.repayment_count,
                "on_time_rate": w.on_time_rate, "avg_days_late": w.avg_days_late,
                "default_count": w.default_count, "disposable_income": w.disposable_income,
                "earnings": [asdict(e) for e in w.earnings],
                "expenses": [asdict(e) for e in w.expenses],
                "repayments": [asdict(r) for r in w.repayments],
            }
            data.append(d)
        with open(path, "w") as f:
            json.dump({"workers": data, "generated_at": "2026-02-22", "count": len(data)}, f, indent=2)
        return path

    def _write_flat_csv(self) -> str:
        path = os.path.join(self.data_dir, "workers_500.csv")
        fields = [
            "worker_id", "name", "platform", "country", "currency",
            "archetype", "months_active", "avg_wage", "income_volatility",
            "income_state", "debt_to_income", "repayment_count", "on_time_rate",
            "avg_days_late", "default_count", "disposable_income",
        ]
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for w in self.workers:
                writer.writerow({
                    "worker_id": w.worker_id, "name": w.name,
                    "platform": w.platform,
                    "country": w.country,
                    "currency": w.currency,
                    "archetype": w.archetype, "months_active": w.months_active,
                    "avg_wage": w.avg_wage, "income_volatility": w.income_volatility,
                    "income_state": w.income_state, "debt_to_income": w.debt_to_income,
                    "repayment_count": w.repayment_count, "on_time_rate": w.on_time_rate,
                    "avg_days_late": w.avg_days_late, "default_count": w.default_count,
                    "disposable_income": w.disposable_income,
                })
        return path

    def _write_earnings_csv(self) -> str:
        path = os.path.join(self.data_dir, "earnings_detail.csv")
        fields = ["worker_id", "month", "gross_earning", "platform_fees", "net_earning", "currency", "prev_month_net", "country"]
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for w in self.workers:
                for e in w.earnings:
                    writer.writerow(asdict(e))
        return path

    def _write_repayments_csv(self) -> str:
        path = os.path.join(self.data_dir, "repayments_detail.csv")
        fields = ["advance_id", "worker_id", "amount", "date_issued", "date_due", "date_repaid", "status", "days_late"]
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for w in self.workers:
                for r in w.repayments:
                    writer.writerow(asdict(r))
        return path

    def _write_expenses_csv(self) -> str:
        path = os.path.join(self.data_dir, "expenses_detail.csv")
        fields = ["worker_id", "month", "rent", "transport", "food", "insurance", "total"]
        with open(path, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for w in self.workers:
                for e in w.expenses:
                    writer.writerow(asdict(e))
        return path


# ── Report ────────────────────────────────────────────────────────────

def print_report(workers: List[WorkerProfile]) -> None:
    print("=" * 80)
    print("  Synthetic Dataset — 500 Gig Workers (DE + TR)")
    print(f"  Platform: {PLATFORM}  |  Countries: Germany (EUR) & Turkey (TRY)")
    print("=" * 80)
    # Country split
    de_count = sum(1 for w in workers if w.country == "DE")
    tr_count = sum(1 for w in workers if w.country == "TR")
    print(f"\n  Country Split:  DE={de_count}  TR={tr_count}")
    archetypes: Dict[str, List[WorkerProfile]] = {}
    for w in workers:
        archetypes.setdefault(w.archetype, []).append(w)
    print(f"\n  {'Archetype':<18} {'Count':>5} {'Avg Wage':>10} {'On-Time%':>9} {'Dflts':>6} {'Disp.':>8}")
    print("  " + "─" * 60)
    for arch_name, group in archetypes.items():
        avg_w = statistics.mean(w.avg_wage for w in group)
        avg_ot = statistics.mean(w.on_time_rate for w in group) * 100
        total_def = sum(w.default_count for w in group)
        avg_di = statistics.mean(w.disposable_income for w in group)
        print(
            f"  {arch_name:<18} {len(group):>5}"
            f" {avg_w:>9,.2f} {avg_ot:>8.1f}%"
            f" {total_def:>6}"
            f" {avg_di:>7,.0f}"
        )
    states = {"FEAST": 0, "NORMAL": 0, "FAMINE": 0}
    for w in workers:
        states[w.income_state] = states.get(w.income_state, 0) + 1
    print(f"\n  Income States:  FEAST={states['FEAST']}  NORMAL={states['NORMAL']}  FAMINE={states['FAMINE']}")
    total_repayments = sum(w.repayment_count for w in workers)
    total_defaults = sum(w.default_count for w in workers)
    print(f"  Total Repayments: {total_repayments:,}  |  Total Defaults: {total_defaults}")
    print(f"  Total Workers: {len(workers)}\n")


# ── Main ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate synthetic worker dataset")
    parser.add_argument("--workers", type=int, default=500, help="Number of workers")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    print(f"\n  🔧 Generating {args.workers} workers (seed={args.seed})...\n")
    generator = WorkerDatasetGenerator(total_workers=args.workers, seed=args.seed)
    workers = generator.generate()

    exporter = DatasetExporter(workers)
    paths = exporter.export_all()

    print_report(workers)

    print("  📁 Files generated:")
    for label, path in paths.items():
        size = os.path.getsize(path)
        unit = "KB" if size > 1024 else "B"
        display = f"{size / 1024:.1f}" if size > 1024 else str(size)
        print(f"     {label:<12} → {os.path.basename(path)}  ({display} {unit})")
    print()


if __name__ == "__main__":
    main()
