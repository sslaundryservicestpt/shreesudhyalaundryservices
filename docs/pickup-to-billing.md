# Shree Sudhya pickup-to-billing workflow

## Set up the workspace

1. Sign in with an active staff account at `http://localhost:3002/login`. The former demo URL now leads to sign-in.
2. As Admin, create the client, its branch or individual site, a processing unit, and an active laundry service. Invite or provision the assigned pickup and delivery staff.
3. On **Operations → Log a pickup request**, open **Set up the standard item catalogue** and confirm **Add standard item names**. This imports the 14 piece-count names without setting prices. Resolve any conflicting, archived or kilogram-based catalogue entries first.
4. From the client record, choose **Set client rates**. Add approved item and service rates with effective dates. Leave the branch blank for a rate shared by that client's sites. Add an approved branch override when a site has a separate agreement. This action uses the existing Admin role.
5. In Settings and Finance, review the proof-of-delivery policy, legal invoice details, currency, tax settings and contractual pricing date before billing.

## Work a real order

The live workspace opens the dashboard for the signed-in role. Admin sees setup, exceptions and billing. Supervisor sees the laundry's intake, processing and release queues. Executive sees assigned pickups due today or earlier in Tirupati, plus open deliveries. Each dashboard links to its next steps and explains what to do when the queue is empty.

The role choices on the localhost login also open guided previews when isolated test accounts are unavailable. Those previews use sample records and cannot change live work.

| Who             | What to do                                                                                                                                                                               | What changes                                                                                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supervisor      | Log the phone call or WhatsApp message. Choose client site, unit, scheduled time, service and pickup executive.                                                                          | The order enters the executive's pickup queue as Pending pickup.                                                                                                                                                                                                                             |
| Executive       | Start travel, confirm arrival and record all collected counts. Use zero for items you did not collect.                                                                                   | The saved counts are the pickup observation. The order moves to the laundry's receiving queue.                                                                                                                                                                                               |
| Supervisor      | Physically count each item and select **Verify inward counts** once.                                                                                                                     | Matching counts enter Processing. Mismatches go to Exceptions and require Admin review. Both original counts are retained.                                                                                                                                                                   |
| Supervisor      | Allocate batches, complete their steps and record QC.                                                                                                                                    | Passed pieces move toward final verification. Rejected pieces go to rework.                                                                                                                                                                                                                  |
| Supervisor      | Recount packed quantities and select **Verify and queue delivery**. Confirm the driver and optionally add the dispatch route label.                                                      | The server requires the packed count to match every item still due. Successful verification releases and assigns the order in one transaction. A mismatch cannot queue delivery.                                                                                                             |
| Executive       | Check Deliveries, confirm dispatch and record the recipient and accepted counts.                                                                                                         | Orders with the same supervisor-entered route label are suggested together when visible on the same queue page. Each stop keeps separate proof and counts. Under the current return rule, return rejected items physically before recording an outcome that places them back at the laundry. |
| Admin / billing | Open the client record, choose **Review billing cycle**, select a branch and enter the completed period and due date. Select **Generate bill draft**, then review, approve and issue it. | Only fully delivered, reconciled and unreserved orders in the selected window become invoice sources. Approved rates drive amounts. Each branch has its own bill within the client account.                                                                                                  |

The active work queues refresh every 20 seconds while visible and when the window regains focus. No WhatsApp message or push notification is sent. Logging a WhatsApp enquiry is currently manual. Automatic WhatsApp intake requires a configured provider and a way to confirm which customer site the message belongs to. The route label is a dispatch grouping chosen by the supervisor. It is separate from geographic routing and optimization.

## Price sheets supplied for review

Values are INR per piece. The two sheets use different prices. The app uses the names but does not install these figures as approved client rates.

| Particular       | Poster price | Comparison sheet proposal |
| ---------------- | -----------: | ------------------------: |
| Single Bed Sheet |            — |                        10 |
| Double Bed Sheet |           25 |                        20 |
| Single Duvet     |            — |                        15 |
| Double Duvet     |           30 |                        25 |
| Pillowcase       |           15 |                        10 |
| Bath Towel       |           20 |                        10 |
| Hand Towel       |           10 |                         5 |
| Bath Mat         |           15 |                         9 |
| Single Blanket   |            — |                        10 |
| Double Blanket   |            — |                        15 |
| Curtains         |           50 |                        25 |
| Sofa Cover       |           20 |                         5 |
| Bed Protector    |           30 |                        20 |
| Table Runner     |           20 |                         8 |

An em dash means the poster leaves the price blank. The comparison sheet's “Duet”, “Pillow Cover” and “Runner” entries correspond to the Duvet, Pillowcase and Table Runner names in the poster.
