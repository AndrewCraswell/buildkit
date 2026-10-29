import { createFileRoute, Link } from "@tanstack/react-router"
import { StatusLabel } from "../../components"
import { formatDate, formatMoney } from "../../format"
import { listInvoices } from "../../invoices.functions"

export const Route = createFileRoute("/invoices/")({
  loader: () => listInvoices(),
  head: () => ({ meta: [{ title: "Invoices – Better Apps example" }] }),
  component: Invoices
})

function Invoices() {
  const invoices = Route.useLoaderData()
  return (
    <>
      <h1>Invoices</h1>
      <div className="table-scroll">
        <table>
          <caption className="visually-hidden">All invoices, newest first</caption>
          <thead>
            <tr>
              <th scope="col">Invoice</th>
              <th scope="col">Customer</th>
              <th scope="col" className="optional">
                Due
              </th>
              <th scope="col">Status</th>
              <th scope="col" className="numeric">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <th scope="row">
                  <Link to="/invoices/$invoiceId" params={{ invoiceId: invoice.id }}>
                    {invoice.number}
                  </Link>
                </th>
                <td>{invoice.customer}</td>
                <td className="optional">
                  <time dateTime={invoice.dueOn}>{formatDate(invoice.dueOn)}</time>
                </td>
                <td>
                  <StatusLabel status={invoice.status} />
                </td>
                <td className="numeric">{formatMoney(invoice.amount, invoice.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
