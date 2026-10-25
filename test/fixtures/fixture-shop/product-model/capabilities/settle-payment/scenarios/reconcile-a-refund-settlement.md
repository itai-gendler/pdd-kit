---
kind: primary
routes:
  webhook: Webhook
steps:
  - text: The payment gateway reports a refund as settled
    kind: actor
    actor: payment-gateway
    entities:
      - { entity: refund, effect: changes, from: Requested, to: Settled, facts: [] }
    contexts:
      webhook:
        place: payment-webhook
  - text: The settlement is recorded and the customer is notified
    kind: product
    actor: payment-gateway
    entities: []
    contexts:
      webhook:
        place: payment-webhook
---

# Reconcile a refund settlement

## Trigger

The payment gateway reports that a requested refund has settled.

## Outcome

The refund is settled and the shopper knows the money is on its way.
