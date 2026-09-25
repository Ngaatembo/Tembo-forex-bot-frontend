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
