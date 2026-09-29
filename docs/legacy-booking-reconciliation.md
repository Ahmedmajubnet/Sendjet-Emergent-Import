# Legacy booking reconciliation design — not an executable migration

No automatic repair is safe for missing recipient information or uncertain payment
and handover evidence. Audit first. Use an explicit reviewed list of match IDs,
database backup/snapshot, and an operator with narrowly scoped permissions.

1. Review the read-only report. Identify active real bookings and confirm sender,
   traveler, shipment and trip identities. Do not classify users by email domain.
2. For missing private recipients, request the actual name/email from the sender
   through an authenticated flow. Store only in `shipment_private_details` after
   ownership checks. Never substitute sender/traveler email or a dummy recipient.
3. For payment inconsistencies/multiple attempts, use the configured Stripe account
   and mode to retrieve **every** session/PaymentIntent/Charge. Compare amount,
   currency, metadata and payment/refund evidence. Identify the canonical paid
   transaction; explicitly expire competing open sessions before permitting new
   checkout. Refund/financial actions need separate review and authorization.
4. For unknown checkout results older than 23 hours, inspect Stripe by the recorded
   match/attempt metadata and time window. Do not delete the attempt or rotate its
   key until absence/expiration of all payable sessions is verified. Persist the
   recovered session ID and re-run the ordinary reconciliation path where valid.
5. For paid but uncollected shipments, link the verified transaction/assignment and
   run the existing idempotent paid reconciliation to initialize confirmation data.
   Send a fresh pickup code only to the actual sender. Do not print/export codes.
6. For shipments already handed over/in transit/delivered without confirmation
   evidence, obtain documentary/user confirmation and review an explicit recovery
   workflow. Never fabricate successful code checks or rewind shipment states.
   Keep the record blocked until an approved per-booking resolution exists.
7. Any future write command must default to dry run; require explicit match IDs,
   expected original states and an audit reference; compare-and-set each mutation;
   record operator/reason/time without PII/codes; support retry without duplication.
   Stop on conflicts. Re-run the read-only audit and validate affected bookings.

Historical role, transport-mode and notification timestamp normalization, if ever
needed, must be separately reviewed bounded migrations. Do not recreate the old
startup cleanup. Shipment photos and real users must never be erased by a migration
whose purpose is demo refresh.
