// PayPal Merchant data API — fetches transaction history for connected merchant accounts

export type PayPalTransaction = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  date: string;
  email?: string;
  note?: string;
};

export type PayPalSummary = {
  totalIn: number;
  totalOut: number;
  net: number;
  currency: string;
  transactions: PayPalTransaction[];
  period: { from: string; to: string };
};

export async function getPayPalTransactions(
  accessToken: string,
  from: Date,
  to: Date
): Promise<PayPalSummary> {
  const startDate = from.toISOString().slice(0, 19) + "Z";
  const endDate = to.toISOString().slice(0, 19) + "Z";

  const res = await fetch(
    `https://api-m.paypal.com/v1/reporting/transactions?start_date=${startDate}&end_date=${endDate}&fields=all&page_size=500`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal API error: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const txns = (data.transaction_details ?? []) as any[];

  let totalIn = 0;
  let totalOut = 0;

  const transactions: PayPalTransaction[] = txns.map((t: any) => {
    const info = t.transaction_info;
    const amount = parseFloat(info.transaction_amount?.value ?? "0");
    if (amount > 0) totalIn += amount;
    else totalOut += Math.abs(amount);

    return {
      id: info.transaction_id,
      amount,
      currency: info.transaction_amount?.currency_code ?? "GBP",
      status: info.transaction_status,
      type: info.transaction_event_code ?? "unknown",
      date: info.transaction_initiation_date,
      email: t.payer_info?.email_address,
      note: info.transaction_note,
    };
  });

  return {
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    currency: transactions[0]?.currency ?? "GBP",
    transactions: transactions.slice(0, 100),
    period: { from: from.toISOString(), to: to.toISOString() },
  };
}

export async function refreshPayPalToken(
  clientId: string,
  clientSecret: string
): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch("https://api-m.paypal.com/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
