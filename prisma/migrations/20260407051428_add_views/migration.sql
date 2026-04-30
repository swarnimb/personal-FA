-- Create v_liquid_cash view
-- Returns a single row with total liquid cash across active Checking + Savings accounts.
-- id = 1 is a dummy key required by Prisma's view validation.
CREATE VIEW "v_liquid_cash" AS
SELECT
  1 AS "id",
  COALESCE(SUM("currentBalanceCents"), 0) AS "totalCents"
FROM "Account"
WHERE "type" IN ('Checking', 'Savings')
  AND "isActive" = true;

-- Create v_net_worth view
-- Returns a single row with total assets, total liabilities, and net worth.
-- id = 1 is a dummy key required by Prisma's view validation.
CREATE VIEW "v_net_worth" AS
SELECT
  1 AS "id",
  COALESCE(SUM(CASE WHEN "type" NOT IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "totalAssetsCents",
  COALESCE(SUM(CASE WHEN "type" IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0)     AS "totalLiabilitiesCents",
  COALESCE(SUM(CASE WHEN "type" NOT IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN "type" IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0)   AS "netWorthCents"
FROM "Account"
WHERE "isActive" = true;
