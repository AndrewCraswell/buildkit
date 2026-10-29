import { createFileRoute } from "@tanstack/react-router"
import { BackLink, StatusLabel } from "../../components"
import { formatDate, formatMoney } from "../../format"
import { getInvoice } from "../../invoices.functions"

export const Route = createFileRoute("/invoices/$invoiceId")({
  loader: ({ params }) => getInvoice({ data: { id: params.invoiceId } }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData ? `Invoice ${loaderData.number}` : "Invoice"} – Better Apps example` }]
  }),
  component: InvoiceDetail,
  notFoundComponent: InvoiceNotFound
})

function InvoiceDetail() {
  const invoice = Route.useLoaderData()
  return (
    <article aria-labelledby="invoice-title">
      <BackLink to="/invoices">All invoices</BackLink>
      <h1 id="invoice-title">Invoice {invoice.number}</h1>
      <dl className="details">
        <div>
          <dt>Customer</dt>
          <dd>{invoice.customer}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatMoney(invoice.amount, invoice.currency)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusLabel status={invoice.status} />
          </dd>
        </div>
        <div>
          <dt>Issued</dt>
          <dd>
            <time dateTime={invoice.issuedOn}>{formatDate(invoice.issuedOn)}</time>
          </dd>
        </div>
        <div>
          <dt>Due</dt>
          <dd>
            <time dateTime={invoice.dueOn}>{formatDate(invoice.dueOn)}</time>
          </dd>
        </div>
      </dl>
    </article>
  )
}

function InvoiceNotFound() {
  return (
    <section aria-labelledby="invoice-missing-title">
      <BackLink to="/invoices">All invoices</BackLink>
      <h1 id="invoice-missing-title">Invoice not found</h1>
      <p>There’s no invoice at this address.</p>
    </section>
  )
}
