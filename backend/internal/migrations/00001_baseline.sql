-- +goose Up
-- Baseline schema squashed from migrations 00001..00025 at alpha (ADR-0031).
-- Generated from pg_dump --schema-only of the full chain; schema-verified identical
-- to the 25-file chain and to the dev DB (zero drift) before the goose markers were
-- collapsed. See ADR-0031 for the procedure.

--
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: asset_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    year_month date NOT NULL,
    amount numeric(20,4) NOT NULL,
    currency text NOT NULL,
    as_of_date date,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    display_name text NOT NULL,
    description text,
    subtype text NOT NULL,
    ownership_type text NOT NULL,
    sole_owner_user_id uuid,
    native_currency text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    terminated_at date,
    termination_note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tag_id uuid,
    CONSTRAINT assets_check CHECK (((ownership_type = 'sole'::text) = (sole_owner_user_id IS NOT NULL))),
    CONSTRAINT assets_lifecycle_chk CHECK (((status = 'active'::text) = (terminated_at IS NULL))),
    CONSTRAINT assets_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['sole'::text, 'joint'::text]))),
    CONSTRAINT assets_status_check CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text, 'sold'::text, 'disposed'::text]))),
    CONSTRAINT assets_subtype_check CHECK ((subtype = ANY (ARRAY['bank_account'::text, 'property'::text, 'vehicle'::text])))
);


--
-- Name: bank_account_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_account_details (
    asset_id uuid NOT NULL,
    bank_name text NOT NULL,
    account_number text NOT NULL,
    account_type text NOT NULL,
    CONSTRAINT bank_account_details_account_type_check CHECK ((account_type = ANY (ARRAY['savings'::text, 'current'::text, 'other'::text])))
);


--
-- Name: bond_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bond_details (
    investment_id uuid NOT NULL,
    bond_type text NOT NULL,
    issuer text NOT NULL,
    coupon_rate numeric(20,8) NOT NULL,
    coupon_frequency text DEFAULT 'monthly'::text NOT NULL,
    maturity_date date NOT NULL,
    series_code text,
    CONSTRAINT bond_details_bond_type_check CHECK ((bond_type = ANY (ARRAY['govt_primary'::text, 'secondary_market'::text]))),
    CONSTRAINT bond_details_coupon_frequency_check CHECK ((coupon_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'semi_annual'::text, 'annual'::text])))
);


--
-- Name: fx_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fx_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    year_month date NOT NULL,
    currency text NOT NULL,
    rate numeric(20,8) NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: gold_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gold_details (
    investment_id uuid NOT NULL,
    form text NOT NULL,
    purity numeric(5,4) NOT NULL,
    CONSTRAINT gold_details_form_check CHECK ((form = ANY (ARRAY['bar'::text, 'coin'::text, 'digital'::text, 'jewelry'::text]))),
    CONSTRAINT gold_details_purity_check CHECK (((purity > (0)::numeric) AND (purity <= (1)::numeric)))
);


--
-- Name: household_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.household_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    invited_email text NOT NULL,
    token text NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone
);


--
-- Name: households; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.households (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    display_name text NOT NULL,
    reporting_currency text DEFAULT 'IDR'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    multi_currency_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: income; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    date date NOT NULL,
    amount numeric(20,4) NOT NULL,
    currency text NOT NULL,
    category text NOT NULL,
    description text,
    ownership_type text NOT NULL,
    sole_owner_user_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    regularity text NOT NULL,
    CONSTRAINT income_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT income_category_check CHECK ((category = ANY (ARRAY['salary'::text, 'business_income'::text, 'rental_income'::text, 'gift'::text, 'tax_refund'::text, 'insurance_payout'::text, 'other'::text]))),
    CONSTRAINT income_check CHECK (((ownership_type = 'sole'::text) = (sole_owner_user_id IS NOT NULL))),
    CONSTRAINT income_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['sole'::text, 'joint'::text]))),
    CONSTRAINT income_regularity_check CHECK ((regularity = ANY (ARRAY['routine'::text, 'incidental'::text])))
);


--
-- Name: investment_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investment_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investment_id uuid NOT NULL,
    year_month date NOT NULL,
    amount numeric(20,4) NOT NULL,
    currency text NOT NULL,
    quantity numeric(20,8),
    price_per_unit numeric(20,4),
    accrued_interest numeric(20,4),
    as_of_date date,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT investment_snapshot_shape CHECK ((((quantity IS NOT NULL) AND (price_per_unit IS NOT NULL) AND (accrued_interest IS NULL)) OR ((quantity IS NULL) AND (price_per_unit IS NULL) AND (accrued_interest IS NOT NULL))))
);


--
-- Name: investment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    investment_id uuid NOT NULL,
    transaction_type text NOT NULL,
    transaction_date date NOT NULL,
    currency text NOT NULL,
    description text,
    amount numeric(20,4),
    quantity numeric(20,8),
    price_per_unit numeric(20,4),
    principal_amount numeric(20,4),
    interest_amount numeric(20,4),
    principal_disposition text,
    interest_disposition text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT investment_transaction_shape CHECK (
CASE
    WHEN (transaction_type = ANY (ARRAY['buy'::text, 'sell'::text])) THEN ((amount IS NOT NULL) AND (quantity IS NOT NULL) AND (price_per_unit IS NOT NULL) AND (principal_amount IS NULL) AND (interest_amount IS NULL) AND (principal_disposition IS NULL) AND (interest_disposition IS NULL))
    WHEN (transaction_type = ANY (ARRAY['coupon'::text, 'dividend'::text, 'distribution'::text])) THEN ((amount IS NOT NULL) AND (quantity IS NULL) AND (price_per_unit IS NULL) AND (principal_amount IS NULL) AND (interest_amount IS NULL) AND (principal_disposition IS NULL) AND (interest_disposition IS NULL))
    WHEN (transaction_type = 'fee'::text) THEN ((amount IS NOT NULL) AND (((quantity IS NULL) AND (price_per_unit IS NULL)) OR ((quantity IS NOT NULL) AND (price_per_unit IS NOT NULL))) AND (principal_amount IS NULL) AND (interest_amount IS NULL) AND (principal_disposition IS NULL) AND (interest_disposition IS NULL))
    WHEN (transaction_type = 'maturity'::text) THEN ((principal_amount IS NOT NULL) AND (interest_amount IS NOT NULL) AND (principal_disposition IS NOT NULL) AND (interest_disposition IS NOT NULL) AND (amount IS NULL) AND (quantity IS NULL) AND (price_per_unit IS NULL))
    ELSE false
END),
    CONSTRAINT investment_transactions_interest_disposition_check CHECK ((interest_disposition = ANY (ARRAY['rolled_to_new'::text, 'cash_out'::text]))),
    CONSTRAINT investment_transactions_principal_disposition_check CHECK ((principal_disposition = ANY (ARRAY['rolled_to_new'::text, 'cash_out'::text]))),
    CONSTRAINT investment_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['buy'::text, 'sell'::text, 'coupon'::text, 'dividend'::text, 'distribution'::text, 'fee'::text, 'maturity'::text])))
);


--
-- Name: investments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.investments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    display_name text NOT NULL,
    description text,
    subtype text NOT NULL,
    ownership_type text NOT NULL,
    sole_owner_user_id uuid,
    native_currency text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    terminated_at date,
    termination_note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    risk_profile text NOT NULL,
    rolled_from_investment_id uuid,
    tag_id uuid,
    CONSTRAINT investments_check CHECK (((ownership_type = 'sole'::text) = (sole_owner_user_id IS NOT NULL))),
    CONSTRAINT investments_lifecycle_chk CHECK (((status = 'active'::text) = (terminated_at IS NULL))),
    CONSTRAINT investments_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['sole'::text, 'joint'::text]))),
    CONSTRAINT investments_risk_profile_check CHECK ((risk_profile = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text]))),
    CONSTRAINT investments_status_check CHECK ((status = ANY (ARRAY['active'::text, 'sold'::text, 'matured'::text]))),
    CONSTRAINT investments_subtype_check CHECK ((subtype = ANY (ARRAY['stock'::text, 'mutual_fund'::text, 'bond'::text, 'gold'::text, 'time_deposit'::text])))
);


--
-- Name: liabilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liabilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    display_name text NOT NULL,
    description text,
    subtype text NOT NULL,
    ownership_type text NOT NULL,
    sole_owner_user_id uuid,
    native_currency text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    terminated_at date,
    termination_note text,
    counterparty_name text NOT NULL,
    principal numeric(20,4),
    interest_rate numeric(20,8),
    term_months integer,
    start_date date,
    maturity_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tag_id uuid,
    CONSTRAINT liabilities_check CHECK (((ownership_type = 'sole'::text) = (sole_owner_user_id IS NOT NULL))),
    CONSTRAINT liabilities_lifecycle_chk CHECK (((status = 'active'::text) = (terminated_at IS NULL))),
    CONSTRAINT liabilities_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['sole'::text, 'joint'::text]))),
    CONSTRAINT liabilities_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paid_off'::text, 'forgiven'::text, 'written_off'::text]))),
    CONSTRAINT liabilities_subtype_check CHECK ((subtype = ANY (ARRAY['personal'::text, 'institutional'::text])))
);


--
-- Name: liability_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.liability_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    liability_id uuid NOT NULL,
    year_month date NOT NULL,
    amount numeric(20,4) NOT NULL,
    currency text NOT NULL,
    as_of_date date,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: monthly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monthly_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    year_month date NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    nw_total numeric(20,4) DEFAULT 0 NOT NULL,
    nw_assets numeric(20,4) DEFAULT 0 NOT NULL,
    nw_liabilities numeric(20,4) DEFAULT 0 NOT NULL,
    nw_receivables numeric(20,4) DEFAULT 0 NOT NULL,
    nw_investments numeric(20,4) DEFAULT 0 NOT NULL,
    earned_income_total numeric(20,4),
    earned_income_salary numeric(20,4),
    earned_income_business numeric(20,4),
    earned_income_rental numeric(20,4),
    earned_income_gift numeric(20,4),
    earned_income_tax_refund numeric(20,4),
    earned_income_insurance numeric(20,4),
    earned_income_other numeric(20,4),
    investment_return_total numeric(20,4),
    investment_return_stock numeric(20,4),
    investment_return_mutual_fund numeric(20,4),
    investment_return_bond numeric(20,4),
    investment_return_gold numeric(20,4),
    investment_return_time_deposit numeric(20,4),
    asset_value_change numeric(20,4),
    derived_living_expenses numeric(20,4),
    user_breakdowns jsonb DEFAULT '{}'::jsonb NOT NULL,
    fx_rates_used jsonb DEFAULT '{}'::jsonb NOT NULL,
    stale_positions jsonb DEFAULT '[]'::jsonb NOT NULL,
    missing_fx jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: mutual_fund_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mutual_fund_details (
    investment_id uuid NOT NULL,
    fund_code text NOT NULL,
    fund_manager text,
    fund_type text NOT NULL,
    CONSTRAINT mutual_fund_details_fund_type_check CHECK ((fund_type = ANY (ARRAY['money_market'::text, 'fixed_income'::text, 'equity'::text, 'mixed'::text, 'index'::text, 'etf'::text, 'target_date'::text, 'commodity'::text, 'other'::text])))
);


--
-- Name: property_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.property_details (
    asset_id uuid NOT NULL,
    property_type text NOT NULL,
    address text,
    acquisition_date date,
    acquisition_cost numeric(20,4),
    annual_appreciation_rate numeric(20,8),
    CONSTRAINT property_details_property_type_check CHECK ((property_type = ANY (ARRAY['house'::text, 'apartment'::text, 'land'::text, 'commercial'::text])))
);


--
-- Name: receivable_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivable_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    receivable_id uuid NOT NULL,
    year_month date NOT NULL,
    amount numeric(20,4) NOT NULL,
    currency text NOT NULL,
    as_of_date date,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: receivables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.receivables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    display_name text NOT NULL,
    description text,
    ownership_type text NOT NULL,
    sole_owner_user_id uuid,
    native_currency text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    terminated_at date,
    termination_note text,
    counterparty_name text NOT NULL,
    due_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    tag_id uuid,
    CONSTRAINT receivables_check CHECK (((ownership_type = 'sole'::text) = (sole_owner_user_id IS NOT NULL))),
    CONSTRAINT receivables_lifecycle_chk CHECK (((status = 'active'::text) = (terminated_at IS NULL))),
    CONSTRAINT receivables_ownership_type_check CHECK ((ownership_type = ANY (ARRAY['sole'::text, 'joint'::text]))),
    CONSTRAINT receivables_status_check CHECK ((status = ANY (ARRAY['active'::text, 'collected'::text, 'written_off'::text])))
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    user_agent text
);


--
-- Name: stock_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_details (
    investment_id uuid NOT NULL,
    ticker text NOT NULL,
    exchange text NOT NULL
);


--
-- Name: tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: time_deposit_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_deposit_details (
    investment_id uuid NOT NULL,
    bank_name text NOT NULL,
    principal numeric(20,4) NOT NULL,
    interest_rate numeric(20,8) NOT NULL,
    term_months integer NOT NULL,
    placement_date date NOT NULL,
    maturity_date date NOT NULL,
    rollover_policy text NOT NULL,
    CONSTRAINT time_deposit_details_rollover_policy_check CHECK ((rollover_policy = ANY (ARRAY['auto_renew_principal'::text, 'auto_renew_with_interest'::text, 'no_rollover'::text]))),
    CONSTRAINT time_deposit_details_term_months_check CHECK ((term_months > 0))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    household_id uuid NOT NULL,
    display_name text NOT NULL,
    email text NOT NULL,
    google_sub text NOT NULL,
    locale text DEFAULT 'id-ID'::text NOT NULL,
    time_zone text DEFAULT 'Asia/Jakarta'::text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    nickname text,
    picture_url text,
    theme text DEFAULT 'dark'::text NOT NULL,
    CONSTRAINT users_locale_check CHECK ((locale = ANY (ARRAY['en-GB'::text, 'id-ID'::text]))),
    CONSTRAINT users_nickname_check CHECK (((nickname IS NULL) OR ((char_length(nickname) >= 1) AND (char_length(nickname) <= 32)))),
    CONSTRAINT users_theme_check CHECK ((theme = ANY (ARRAY['light'::text, 'dark'::text])))
);


--
-- Name: vehicle_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vehicle_details (
    asset_id uuid NOT NULL,
    vehicle_type text NOT NULL,
    make text,
    model text,
    year integer,
    plate_number text,
    annual_depreciation_rate numeric(20,8),
    CONSTRAINT vehicle_details_vehicle_type_check CHECK ((vehicle_type = ANY (ARRAY['car'::text, 'motorcycle'::text, 'other'::text])))
);


--
-- Name: asset_snapshots asset_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_snapshots
    ADD CONSTRAINT asset_snapshots_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: bank_account_details bank_account_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_details
    ADD CONSTRAINT bank_account_details_pkey PRIMARY KEY (asset_id);


--
-- Name: bond_details bond_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bond_details
    ADD CONSTRAINT bond_details_pkey PRIMARY KEY (investment_id);


--
-- Name: fx_rates fx_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_pkey PRIMARY KEY (id);


--
-- Name: gold_details gold_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gold_details
    ADD CONSTRAINT gold_details_pkey PRIMARY KEY (investment_id);


--
-- Name: household_invitations household_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_invitations
    ADD CONSTRAINT household_invitations_pkey PRIMARY KEY (id);


--
-- Name: household_invitations household_invitations_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_invitations
    ADD CONSTRAINT household_invitations_token_key UNIQUE (token);


--
-- Name: households households_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_pkey PRIMARY KEY (id);


--
-- Name: income income_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_pkey PRIMARY KEY (id);


--
-- Name: investment_snapshots investment_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_snapshots
    ADD CONSTRAINT investment_snapshots_pkey PRIMARY KEY (id);


--
-- Name: investment_transactions investment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_pkey PRIMARY KEY (id);


--
-- Name: investments investments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_pkey PRIMARY KEY (id);


--
-- Name: liabilities liabilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_pkey PRIMARY KEY (id);


--
-- Name: liability_snapshots liability_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liability_snapshots
    ADD CONSTRAINT liability_snapshots_pkey PRIMARY KEY (id);


--
-- Name: monthly_reports monthly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_pkey PRIMARY KEY (id);


--
-- Name: mutual_fund_details mutual_fund_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mutual_fund_details
    ADD CONSTRAINT mutual_fund_details_pkey PRIMARY KEY (investment_id);


--
-- Name: property_details property_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_details
    ADD CONSTRAINT property_details_pkey PRIMARY KEY (asset_id);


--
-- Name: receivable_snapshots receivable_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivable_snapshots
    ADD CONSTRAINT receivable_snapshots_pkey PRIMARY KEY (id);


--
-- Name: receivables receivables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: stock_details stock_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_details
    ADD CONSTRAINT stock_details_pkey PRIMARY KEY (investment_id);


--
-- Name: tags tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_pkey PRIMARY KEY (id);


--
-- Name: time_deposit_details time_deposit_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_deposit_details
    ADD CONSTRAINT time_deposit_details_pkey PRIMARY KEY (investment_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_details vehicle_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_details
    ADD CONSTRAINT vehicle_details_pkey PRIMARY KEY (asset_id);


--
-- Name: asset_snapshots_asset_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX asset_snapshots_asset_id_idx ON public.asset_snapshots USING btree (asset_id) WHERE (deleted_at IS NULL);


--
-- Name: asset_snapshots_asset_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX asset_snapshots_asset_year_month_idx ON public.asset_snapshots USING btree (asset_id, year_month) WHERE (deleted_at IS NULL);


--
-- Name: assets_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_household_id_idx ON public.assets USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: fx_rates_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fx_rates_household_id_idx ON public.fx_rates USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: fx_rates_household_year_month_currency_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fx_rates_household_year_month_currency_idx ON public.fx_rates USING btree (household_id, year_month, currency) WHERE (deleted_at IS NULL);


--
-- Name: household_invitations_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX household_invitations_household_id_idx ON public.household_invitations USING btree (household_id) WHERE (used_at IS NULL);


--
-- Name: income_household_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX income_household_date_idx ON public.income USING btree (household_id, date DESC) WHERE (deleted_at IS NULL);


--
-- Name: investment_snapshots_investment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX investment_snapshots_investment_id_idx ON public.investment_snapshots USING btree (investment_id) WHERE (deleted_at IS NULL);


--
-- Name: investment_snapshots_investment_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX investment_snapshots_investment_year_month_idx ON public.investment_snapshots USING btree (investment_id, year_month) WHERE (deleted_at IS NULL);


--
-- Name: investment_transactions_investment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX investment_transactions_investment_date_idx ON public.investment_transactions USING btree (investment_id, transaction_date DESC) WHERE (deleted_at IS NULL);


--
-- Name: investment_transactions_investment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX investment_transactions_investment_id_idx ON public.investment_transactions USING btree (investment_id) WHERE (deleted_at IS NULL);


--
-- Name: investments_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX investments_household_id_idx ON public.investments USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: liabilities_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX liabilities_household_id_idx ON public.liabilities USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: liability_snapshots_liability_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX liability_snapshots_liability_id_idx ON public.liability_snapshots USING btree (liability_id) WHERE (deleted_at IS NULL);


--
-- Name: liability_snapshots_liability_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX liability_snapshots_liability_year_month_idx ON public.liability_snapshots USING btree (liability_id, year_month) WHERE (deleted_at IS NULL);


--
-- Name: monthly_reports_household_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX monthly_reports_household_year_month_idx ON public.monthly_reports USING btree (household_id, year_month);


--
-- Name: receivable_snapshots_receivable_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receivable_snapshots_receivable_id_idx ON public.receivable_snapshots USING btree (receivable_id) WHERE (deleted_at IS NULL);


--
-- Name: receivable_snapshots_receivable_year_month_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX receivable_snapshots_receivable_year_month_idx ON public.receivable_snapshots USING btree (receivable_id, year_month) WHERE (deleted_at IS NULL);


--
-- Name: receivables_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX receivables_household_id_idx ON public.receivables USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: tags_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tags_household_id_idx ON public.tags USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: tags_household_name_live; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tags_household_name_live ON public.tags USING btree (household_id, lower(name)) WHERE (deleted_at IS NULL);


--
-- Name: users_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_idx ON public.users USING btree (email) WHERE (deleted_at IS NULL);


--
-- Name: users_google_sub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_google_sub_idx ON public.users USING btree (google_sub) WHERE (deleted_at IS NULL);


--
-- Name: users_household_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_household_id_idx ON public.users USING btree (household_id) WHERE (deleted_at IS NULL);


--
-- Name: asset_snapshots asset_snapshots_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_snapshots
    ADD CONSTRAINT asset_snapshots_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: asset_snapshots asset_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_snapshots
    ADD CONSTRAINT asset_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: asset_snapshots asset_snapshots_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_snapshots
    ADD CONSTRAINT asset_snapshots_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: assets assets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: assets assets_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: assets assets_sole_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_sole_owner_user_id_fkey FOREIGN KEY (sole_owner_user_id) REFERENCES public.users(id);


--
-- Name: assets assets_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id);


--
-- Name: assets assets_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: bank_account_details bank_account_details_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_account_details
    ADD CONSTRAINT bank_account_details_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: bond_details bond_details_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bond_details
    ADD CONSTRAINT bond_details_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: fx_rates fx_rates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: fx_rates fx_rates_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: fx_rates fx_rates_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fx_rates
    ADD CONSTRAINT fx_rates_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: gold_details gold_details_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gold_details
    ADD CONSTRAINT gold_details_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: household_invitations household_invitations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_invitations
    ADD CONSTRAINT household_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: household_invitations household_invitations_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_invitations
    ADD CONSTRAINT household_invitations_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: households households_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: households households_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.households
    ADD CONSTRAINT households_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: income income_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: income income_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: income income_sole_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_sole_owner_user_id_fkey FOREIGN KEY (sole_owner_user_id) REFERENCES public.users(id);


--
-- Name: income income_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: investment_snapshots investment_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_snapshots
    ADD CONSTRAINT investment_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: investment_snapshots investment_snapshots_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_snapshots
    ADD CONSTRAINT investment_snapshots_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: investment_snapshots investment_snapshots_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_snapshots
    ADD CONSTRAINT investment_snapshots_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: investment_transactions investment_transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: investment_transactions investment_transactions_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: investment_transactions investment_transactions_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investment_transactions
    ADD CONSTRAINT investment_transactions_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: investments investments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: investments investments_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: investments investments_rolled_from_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_rolled_from_investment_id_fkey FOREIGN KEY (rolled_from_investment_id) REFERENCES public.investments(id);


--
-- Name: investments investments_sole_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_sole_owner_user_id_fkey FOREIGN KEY (sole_owner_user_id) REFERENCES public.users(id);


--
-- Name: investments investments_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id);


--
-- Name: investments investments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.investments
    ADD CONSTRAINT investments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: liabilities liabilities_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: liabilities liabilities_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: liabilities liabilities_sole_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_sole_owner_user_id_fkey FOREIGN KEY (sole_owner_user_id) REFERENCES public.users(id);


--
-- Name: liabilities liabilities_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id);


--
-- Name: liabilities liabilities_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liabilities
    ADD CONSTRAINT liabilities_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: liability_snapshots liability_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liability_snapshots
    ADD CONSTRAINT liability_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: liability_snapshots liability_snapshots_liability_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liability_snapshots
    ADD CONSTRAINT liability_snapshots_liability_id_fkey FOREIGN KEY (liability_id) REFERENCES public.liabilities(id);


--
-- Name: liability_snapshots liability_snapshots_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.liability_snapshots
    ADD CONSTRAINT liability_snapshots_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: monthly_reports monthly_reports_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monthly_reports
    ADD CONSTRAINT monthly_reports_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: mutual_fund_details mutual_fund_details_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mutual_fund_details
    ADD CONSTRAINT mutual_fund_details_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: property_details property_details_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.property_details
    ADD CONSTRAINT property_details_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
-- Name: receivable_snapshots receivable_snapshots_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivable_snapshots
    ADD CONSTRAINT receivable_snapshots_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: receivable_snapshots receivable_snapshots_receivable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivable_snapshots
    ADD CONSTRAINT receivable_snapshots_receivable_id_fkey FOREIGN KEY (receivable_id) REFERENCES public.receivables(id);


--
-- Name: receivable_snapshots receivable_snapshots_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivable_snapshots
    ADD CONSTRAINT receivable_snapshots_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: receivables receivables_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: receivables receivables_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: receivables receivables_sole_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_sole_owner_user_id_fkey FOREIGN KEY (sole_owner_user_id) REFERENCES public.users(id);


--
-- Name: receivables receivables_tag_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES public.tags(id);


--
-- Name: receivables receivables_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.receivables
    ADD CONSTRAINT receivables_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: stock_details stock_details_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_details
    ADD CONSTRAINT stock_details_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: tags tags_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tags tags_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: tags tags_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tags
    ADD CONSTRAINT tags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: time_deposit_details time_deposit_details_investment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_deposit_details
    ADD CONSTRAINT time_deposit_details_investment_id_fkey FOREIGN KEY (investment_id) REFERENCES public.investments(id);


--
-- Name: users users_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: users users_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.households(id);


--
-- Name: users users_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id);


--
-- Name: vehicle_details vehicle_details_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicle_details
    ADD CONSTRAINT vehicle_details_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id);


--
--



-- +goose Down
DROP TABLE IF EXISTS public.asset_snapshots CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.bank_account_details CASCADE;
DROP TABLE IF EXISTS public.bond_details CASCADE;
DROP TABLE IF EXISTS public.fx_rates CASCADE;
DROP TABLE IF EXISTS public.gold_details CASCADE;
DROP TABLE IF EXISTS public.household_invitations CASCADE;
DROP TABLE IF EXISTS public.households CASCADE;
DROP TABLE IF EXISTS public.income CASCADE;
DROP TABLE IF EXISTS public.investment_snapshots CASCADE;
DROP TABLE IF EXISTS public.investment_transactions CASCADE;
DROP TABLE IF EXISTS public.investments CASCADE;
DROP TABLE IF EXISTS public.liabilities CASCADE;
DROP TABLE IF EXISTS public.liability_snapshots CASCADE;
DROP TABLE IF EXISTS public.monthly_reports CASCADE;
DROP TABLE IF EXISTS public.mutual_fund_details CASCADE;
DROP TABLE IF EXISTS public.property_details CASCADE;
DROP TABLE IF EXISTS public.receivable_snapshots CASCADE;
DROP TABLE IF EXISTS public.receivables CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.stock_details CASCADE;
DROP TABLE IF EXISTS public.tags CASCADE;
DROP TABLE IF EXISTS public.time_deposit_details CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.vehicle_details CASCADE;
