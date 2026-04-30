-- Fix v_net_worth view: CreditCard/Loan balances are stored as POSITIVE cents
-- (e.g., $1,847 owed = 184722). They must be subtracted for net worth.
-- Net worth = Assets - Liabilities (both stored as positive values).

DROP VIEW IF EXISTS "v_net_worth";

CREATE VIEW "v_net_worth" AS
SELECT
  1 AS "id",
  COALESCE(SUM(CASE WHEN "type" NOT IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "totalAssetsCents",
  COALESCE(SUM(CASE WHEN "type" IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "totalLiabilitiesCents",
  COALESCE(SUM(CASE WHEN "type" NOT IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN "type" IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "netWorthCents"
FROM "Account"
WHERE "isActive" = true;
