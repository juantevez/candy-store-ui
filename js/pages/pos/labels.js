export const PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Crédito" },
  { value: "mercadopago", label: "Mercado Pago" },
  { value: "bank_transfer", label: "Transferencia" },
];

export function paymentLabel(value) {
  return PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value ?? "—";
}

export const ORDER_STATUS = {
  completed: { label: "Cobrada", tone: "success" },
  cancelled: { label: "Cancelada", tone: "danger" },
  placed: { label: "En curso", tone: "warning" },
  paid: { label: "Pagada", tone: "success" },
  awaiting_payment: { label: "Esperando pago", tone: "warning" },
  refund_required: { label: "A devolver", tone: "danger" },
};
