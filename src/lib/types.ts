// Response shapes of the Tembo backend (FastAPI). Mirrors the dicts the
// routes in backend/app/api/routes/*.py return. Every endpoint is GET-only.

export interface Health {
  status: 'ok' | 'degraded' | string;
  database: string;
  market_data: string;
  news_service: string;
  ai_service: string;
  paper_broker: string;
  live_execution_enabled: boolean;
}

export interface InstrumentInfo {
  instrument: string;
  timeframe: string;
  researched_families: string[];
}

export interface ConsideredCandidate {
  config_id: string;
  gate_status: string;
  reason: string;
}

export interface Decision {
  instrument: string;
  timeframe: string;
  timestamp: string;
  has_validated_edge: boolean;
  selector_status: string;
  selected_config: null | {
    config_id: string;
    candidate_id: string;
    strategy_family: string;
    parameters: Record<string, unknown>;
    gate_status: string;
    verdict: string;
    statistical_level: string;
  };
  research_gate_status: string | null;
  final_decision: string;
  reason: string;
  regime_evidence: Record<string, number> | null;
  considered_candidates: ConsideredCandidate[];
  research_recommendation: string | null;
  news_context: { status: string; freshness: string; provider: string; relevant_news_count: number };
  macro_event_risk: { level: string; reason: string; triggering_event_count: number };
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
}

export interface Market {
  instrument: string;
  timeframe: string;
  provider: string;
  current_price: number;
  instrument_metadata: { symbol: string; display_name: string; pip_size: number; asset_class: string };
  recent_candles: Candle[];
  data_quality: { is_clean: boolean; ohlc_violations: number; duplicate_timestamps: number; unexpected_gaps: number };
}

export interface AccountOverview {
  account_id: string;
  mode: string;
  real_money: number;
  initial_equity: number;
  realized_pnl: number;
  equity: number;
  open_positions_count: number;
  generated_at: string | null;
  note?: string;
}

export interface OpenPosition {
  position_id: string;
  instrument: string;
  timeframe: string;
  direction: 'LONG' | 'SHORT' | string;
  entry_price: number;
  entry_time: string;
  stop_price: number;
  position_size: number;
  candidate_config_id: string;
  take_profit_price: number | null;
  periods_held: number;
  status: string;
}

export interface ClosedTrade {
  trade_id: string;
  position_id: string;
  instrument: string;
  timeframe: string;
  direction: string;
  entry_price: number;
  entry_time: string;
  exit_price: number;
  exit_time: string;
  exit_reason: string;
  position_size: number;
  realized_pnl: number;
  candidate_config_id: string;
}

export interface RiskMetrics {
  limits: Record<string, number>;
  current: { equity: number; realized_pnl: number; open_positions_count: number };
  note?: string;
}

export interface Performance {
  trade_count: number;
  total_realized_pnl: number;
  win_rate: number | null;
  note?: string;
}

export interface EngineEvent {
  type: string;
  scenario?: string;
  status?: string;
  reason?: string;
  instrument?: string;
  timeframe?: string;
  exit_reason?: string;
  realized_pnl?: number;
  timestamp?: string;
}

export interface NewsItem {
  news_id: string;
  timestamp: string;
  headline: string;
  summary: string | null;
  source: string;
  url: string | null;
  category: string | null;
  relevant_instruments: string[];
  sentiment: string | null;
  provider: string;
}

export interface NewsFeed {
  instrument?: string;
  status: string;
  freshness: string;
  provider: string;
  last_successful_fetch: string | null;
  error: string | null;
  items: NewsItem[];
}

export interface MacroEvent {
  event_id: string;
  timestamp: string;
  currency: string;
  country: string | null;
  event_name: string;
  importance: string;
  previous: string | number | null;
  forecast: string | number | null;
  actual: string | number | null;
  source: string | null;
  url: string | null;
  time_confirmed: boolean;
}

export interface Calendar {
  currency?: string;
  status: string;
  events: MacroEvent[];
  error: string | null;
}

export interface DataStatus {
  market_data: { provider: string; status: string };
  news: { provider: string; status: string };
  economic_calendar: { provider: string; status: string };
}

export interface ResearchCandidate {
  candidate_id: string;
  name: string;
  family: string;
  description: string;
  experiment_ids: string[];
  research_priority: string;
  gate_status: string;
  verdict: string;
  created_at: string;
  lineage_note?: string | null;
}

export interface ResearchFamily {
  family: string;
  hypothesis_count: number;
  experiment_count: number;
  rejected_count: number;
  oos_failure_count: number;
  overfit_failure_count: number;
  promising_count: number;
  latest_experiment_at: string | null;
  negative_evidence_density: number;
  saturation_status: string;
}

export interface Baseline {
  baseline_id: string;
  historical_reference: {
    trade_count: number;
    zero_cost_profit_factor: number;
    zero_cost_return: number;
    base_cost_return: number;
    max_drawdown_percent: number;
  };
}


export interface LiveInstrumentState {
  instrument: string;
  timeframe: string;
  provider: string;
  data_status: string;
  current_price: number | null;
  last_update: string | null;
  decision: string;
  reason: string;
}
export interface LiveOverview {
  mode: string;
  mt5: { status: string; message: string };
  execution: { enabled: boolean; note: string };
  market_data: { provider: string; status: string };
  context: { news: string; calendar: string };
  instruments: LiveInstrumentState[];
  trade_plan: {
    instrument: string;
    decision: string;
    entry_price: number | null;
    stop_loss: number | null;
    take_profit: number | null;
    reason: string;
  };
}


export interface LiveMarket {
  instrument: string;
  timeframe: string;
  provider: string;
  status: string;
  current_price: number | null;
  last_update: string | null;
  instrument_metadata?: {
    symbol: string;
    display_name: string;
    pip_size: number;
    asset_class: string;
  };
  candles: Candle[];
  data_quality: {
    is_clean: boolean;
    ohlc_violations: number;
    duplicate_timestamps: number;
    unexpected_gaps: number;
  };
  message: string;
}


export interface LiveAnalysis {
  instrument: string;
  timeframe: string;
  provider: string;
  status: string;
  message: string;
  data_quality?: {
    is_clean: boolean;
    ohlc_violations: number;
    duplicate_timestamps: number;
    unexpected_gaps: number;
  };
  analysis: {
    status: string;
    reason?: string;
    as_of?: string;
    close?: number;
    trend?: {
      state: string;
      regime: string;
      sma_10: number | null;
      sma_50: number | null;
      sma_50_slope: number | null;
      sma_distance_pct: number | null;
    } | null;
    momentum?: {
      state: string;
      rsi_14: number | null;
    } | null;
    volatility?: {
      state: string;
      atr_14: number | null;
      atr_percent: number | null;
    } | null;
    support_resistance?: {
      support: number | null;
      resistance: number | null;
      recent_high: number | null;
      recent_low: number | null;
      rolling_range: number | null;
    } | null;
    market_structure?: {
      label: string;
      confirmed_swing_high: number | null;
      previous_swing_high: number | null;
      confirmed_swing_low: number | null;
      previous_swing_low: number | null;
    } | null;
  } | null;
}

export interface MultiTimeframeAnalysis {
  instrument: string;
  provider: string;
  status: string;
  message: string;
  timeframes: Record<string, LiveAnalysis['analysis'] | { status: string; reason: string } | null>;
}


export interface LiveDecision {
  message?: string;
  instrument: string;
  timeframe: string;
  provider: string;
  status: string;
  decision: string;
  methodology?: string;
  macro_risk?: {
    level: string;
    reason: string;
    triggering_event_count: number;
  };
  data_quality?: {
    is_clean: boolean;
    candle_count: number;
    last_candle?: string;
    ohlc_violations?: number;
    duplicate_timestamps?: number;
    unexpected_gaps?: number;
  };
  strategy_gate?: {
    status: string;
    selected_config_id?: string | null;
    reason: string;
    live_evaluation?: {
      config_id: string;
      strategy_family: string;
      status: string;
      direction: string;
      triggered: boolean;
      entry: number | null;
      stop_loss: number | null;
      take_profit: number | null;
      risk_reward: number | null;
      reason: string;
      parameters?: Record<string, unknown> | string | null;
    } | null;
  };
  technical_decision?: {
    decision: string;
    direction: string;
    confidence: number | null;
    entry: number | null;
    stop_loss: number | null;
    take_profit: number | null;
    risk_reward: number | null;
    factors: Array<{ name: string; score: number; direction: string; reason: string }>;
    rejection_reasons: string[];
    methodology: string;
  };
  market_evidence?: {
    last_close: number | null;
    regime: string | null;
    rsi_14: number | null;
    atr_14: number | null;
    atr_percent: number | null;
  };
  news?: {
    status?: string;
    freshness?: string;
    provider?: string;
    last_successful_fetch?: string | null;
    error?: string | null;
    headlines?: Array<{ news_id?: string; timestamp?: string; headline?: string; source?: string; url?: string | null }>;
  };
  macro_events?: Array<{
    event_id?: string;
    timestamp?: string;
    currency?: string;
    country?: string | null;
    event_name?: string;
    importance?: string;
    previous?: string | number | null;
    forecast?: string | number | null;
    actual?: string | number | null;
    source?: string | null;
    time_confirmed?: boolean;
  }>;
  risk?: {
    status: string;
    state?: string | null;
    hierarchy_stage?: string | null;
    computed_risk_pct?: number | null;
    position_size?: number | null;
    reason: string;
  };
  paper_eligibility?: {
    eligible: boolean;
    status: string;
    reason: string;
    persistent_state_changed: boolean;
    real_broker_contacted: boolean;
    execution_enabled: boolean;
  };
  trade_plan: {
    decision: string;
    direction: string;
    confidence?: number | null;
    entry: number | null;
    stop_loss: number | null;
    take_profit: number | null;
    risk_reward: number | null;
    factors?: Array<{
      name: string;
      score: number;
      direction: string;
      reason: string;
    }>;
    rejection_reasons?: string[];
    methodology?: string;
    reason?: string;
  } | null;
  execution?: {
    enabled: boolean;
    note: string;
  };
}

export interface PaperValidationCheck {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  detail: string;
}

export interface PaperValidation {
  suite: string;
  status: 'PASS' | 'FAIL' | string;
  synthetic: boolean;
  persistent_state_changed: boolean;
  real_broker_contacted: boolean;
  execution_enabled: boolean;
  checked_at: string;
  checks: PaperValidationCheck[];
  note: string;
}


export interface RuntimeStatus {
  status: string;
  account_id: string;
  initial_equity: number;
  realized_pnl: number;
  peak_equity: number;
  open_positions: number;
  last_cycle_at: string | null;
  execution_enabled: boolean;
  broker_contacted: boolean;
}

export interface RuntimeEvent {
  level?: string;
  created_at?: string | null;
  instrument?: string;
  timeframe?: string;
  status?: string;
  reason?: string;
  decision?: string;
  position_id?: string | null;
  last_completed_candle?: string | null;
  data_quality?: { is_clean?: boolean; candle_count?: number; last_candle?: string };
}

export interface BacktestDataset {
  symbol: string;
  timeframe: string;
  candle_count: number;
  first_candle: string | null;
  last_candle: string | null;
}

export interface BacktestReadiness {
  ready: boolean;
  stored_candles: number;
  datasets: BacktestDataset[];
  note: string;
}
export interface RuntimeMetrics {
  mode: string;
  cycles_observed: number;
  events_observed: number;
  decision_status_counts: Record<string, number>;
  rejection_reason_counts: Record<string, number>;
  instrument_event_counts: Record<string, number>;
  performance: {
    closed_trades: number;
    wins: number;
    losses: number;
    win_rate: number | null;
    realized_pnl: number;
    gross_profit: number;
    gross_loss: number;
    profit_factor: number | null;
    by_instrument: Record<string, {
      trades: number;
      realized_pnl: number;
      wins: number;
      losses: number;
    }>;
  };
  execution_enabled: boolean;
  broker_contacted: boolean;
  note: string;
}

export interface RuntimePosition {
  position_id: string;
  instrument: string;
  timeframe: string;
  direction: string;
  entry_price: number;
  stop_price: number;
  take_profit_price: number | null;
  position_size: number;
  candidate_config_id: string;
  entry_time: string;
  periods_held: number;
  last_completed_candle_at: string | null;
  status: string;
}

export interface RuntimeTrade {
  trade_id: string;
  position_id: string;
  instrument: string;
  timeframe: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  position_size: number;
  entry_time: string;
  exit_time: string;
  exit_reason: string;
  realized_pnl: number;
  candidate_config_id: string;
}

export interface SyntheticSymbol {
  symbol: string;
  underlying_symbol: string;
  display_name: string;
  market: string;
  submarket: string;
  subgroup: string;
  pip_size: number;
  exchange_is_open: boolean;
}

export interface SyntheticSymbols {
  provider: string;
  status: string;
  symbols: SyntheticSymbol[];
  message: string;
}

export interface DerivStatus {
  connected?: boolean;
  configured?: boolean;
  mode?: string;
  account_id?: string | null;
  account_type?: string | null;
  status?: string | null;
  currency?: string | null;
  balance?: number | null;
  open_positions?: number;
  positions?: Array<Record<string, unknown>>;
  message?: string;
}

export interface DerivProposal {
  status: string;
  instrument: string;
  underlying_symbol: string;
  direction: string;
  contract_type: string;
  stake: number;
  multiplier: number;
  proposal_id: string;
  ask_price: number;
  spot: number | null;
  payout: number | null;
  currency: string;
  protection: { attached: boolean; limit_order: Record<string, unknown>; source: string };
  execution_token: string;
}

export interface DerivBuy {
  status: string;
  contract_id: number;
  transaction_id?: number | string | null;
  buy_price: number;
  balance_after: number | null;
}

export interface DerivContract {
  status: string;
  contract: Record<string, unknown> & {
    contract_id?: number;
    status?: string;
    is_sold?: number | boolean;
    profit?: number;
    profit_percentage?: number;
    current_spot?: number;
    entry_spot?: number;
    buy_price?: number;
    bid_price?: number;
    currency?: string;
    underlying?: string;
    display_name?: string;
    contract_type?: string;
    limit_order?: Record<string, { order_amount?: number | null; value?: number | string | null } | undefined>;
  };
}
