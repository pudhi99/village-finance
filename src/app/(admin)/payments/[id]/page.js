import { requireAuth } from '@/lib/auth';
import { getPaymentDetails } from '@/features/payments/server-actions';
import PaymentDetailsClient from './PaymentDetailsClient';

export const metadata = {
  title: 'Payment Receipt | Village Finance',
  description: 'Detailed payment receipt and installment FIFO allocation audit view.',
};

export default async function PaymentDetailsPage({ params }) {
  const { id } = await params;
  const { profile } = await requireAuth();

  const payment = await getPaymentDetails(id);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PaymentDetailsClient payment={payment} profile={profile} />
    </div>
  );
}
