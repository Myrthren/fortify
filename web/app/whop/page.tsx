import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { whopCheckoutUrls } from "@/lib/whop-checkout";

export default function WhopPage() {
  const urls = whopCheckoutUrls();
  return <><Nav /><main className="mx-auto max-w-3xl px-6 py-20">
    <span className="eyebrow">Fortify on Whop</span>
    <h1 className="mt-4 text-4xl font-bold">Purchase. Connect. Get started.</h1>
    <p className="mt-5 text-text-muted">Referred by an affiliate? Use their original Whop checkout link to give them credit.</p>
    <ol className="mt-8 list-decimal space-y-5 pl-5">
      <li>Buy your Fortify plan on Whop. Already subscribed through PayPal? Contact support before buying a second subscription.</li>
      <li><a href="/login" className="underline">Sign in to Fortify</a> or create your account.</li>
      <li>Open <a href="/dashboard/settings" className="underline">Settings</a>, choose Connect Whop and sign in with the Whop account you used to purchase.</li>
      <li>Your paid tier activates after connection. If a purchase has just completed, choose Re-sync tier in Settings.</li>
    </ol>
    <div className="mt-10 grid gap-4 sm:grid-cols-3">
      {(["pro", "elite", "apex"] as const).map((tier) => <div key={tier} className="card p-5">
        <h2 className="mb-3 capitalize">{tier}</h2>
        {urls[tier] ? <a href={urls[tier]!} className="btn-primary w-full">Buy on Whop</a> : <p className="text-sm text-text-muted">Checkout is being prepared.</p>}
      </div>)}
    </div>
    <p className="mt-8 text-sm text-text-muted">Manage renewals and cancel billing in your <a href="https://whop.com/orders/" className="underline">Whop orders</a>. Disconnecting Whop in Fortify removes access immediately and does not cancel billing.</p>
  </main><Footer /></>;
}
