'use client';

import { useCreateEvent } from './CreateEventProvider';

export function PricingSection() {
  const { state, updateField, setError, clearError } = useCreateEvent();
  const paymentsEnabled = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED !== 'false';

  const handlePriceChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    updateField('price', numValue);
    
    if (state.data.event_type === 'paid' && numValue <= 0) {
      setError('price', 'Price must be greater than 0 for paid events');
    } else {
      clearError('price');
    }
  };

  const handleEventTypeChange = (eventType: 'free' | 'paid') => {
    updateField('event_type', eventType);
    
    // Clear price error when switching to free
    if (eventType === 'free') {
      clearError('price');
    } else if (state.data.price <= 0) {
      setError('price', 'Price must be greater than 0 for paid events');
    }
  };

  return (
    <div className="space-y-6">
      {!paymentsEnabled && (
        <div className="rounded-md border border-amber-500/60 bg-amber-950/60 px-4 py-3 text-xs text-amber-100">
          Payments are disabled (Test Mode). Paid events will behave as free for testing.
        </div>
      )}
      <div className="border-b border-slate-700 pb-2">
        <h2 className="text-lg font-semibold text-white">Pricing & Payment</h2>
        <p className="text-sm text-slate-400">Set event pricing and payment options</p>
      </div>

      <div className="space-y-6">
        {/* Event Type */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Event Type
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleEventTypeChange('free')}
              className={`rounded-lg p-4 border-2 transition-colors ${
                state.data.event_type === 'free'
                  ? 'border-sky-500 bg-sky-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
              }`}
            >
              <div className="text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">Free</span>
                  {state.data.event_type === 'free' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-400">No payment required</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleEventTypeChange('paid')}
              className={`rounded-lg p-4 border-2 transition-colors ${
                state.data.event_type === 'paid'
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
              }`}
            >
              <div className="text-left">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">Paid</span>
                  {state.data.event_type === 'paid' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Selected
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-400">Charge attendees to register</p>
              </div>
            </button>
          </div>
        </div>

        {/* Price Input (Conditional) */}
        {state.data.event_type === 'paid' && (
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-slate-300 mb-1">
              Price per attendee <span className="text-red-400">*</span>
            </label>
            <div className="relative rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400 sm:text-sm">₹</span>
              </div>
              <input
                type="number"
                id="price"
                value={state.data.price || ''}
                onChange={(e) => handlePriceChange(e.target.value)}
                min="0"
                step="0.01"
                className={`block w-full pl-7 pr-12 py-2 rounded-lg border bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  state.errors.price ? 'border-red-500' : 'border-slate-600'
                }`}
                placeholder="0.00"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-slate-400 sm:text-sm" id="price-currency">
                  INR
                </span>
              </div>
            </div>
            {state.errors.price && (
              <p className="mt-1 text-sm text-red-400">{state.errors.price}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Amount in Indian Rupees (INR)
            </p>
          </div>
        )}

        {/* Payment Methods */}
        <div className="pt-2">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Payment Methods
          </label>
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <input
                id="stripe-payment"
                name="payment-method"
                type="checkbox"
                checked={true}
                disabled
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
              />
              <div>
                <label htmlFor="stripe-payment" className="block text-sm font-medium text-white">
                  Credit/Debit Card (Stripe)
                </label>
                <p className="text-xs text-slate-400">Secure online payments via Stripe</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 pt-1">
              <div className="flex-shrink-0 pt-1">
                <input
                  id="offline-payment"
                  name="offline-payment"
                  type="checkbox"
                  disabled
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-slate-400 focus:ring-slate-500"
                />
              </div>
              <div>
                <label htmlFor="offline-payment" className="block text-sm font-medium text-slate-400">
                  Offline Payment (Coming Soon)
                </label>
                <p className="text-xs text-slate-500">
                  Enable cash, bank transfer, or other offline payment methods
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Mode Notice */}
        {state.data.event_type === 'paid' && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-300">Test Mode</h3>
                <div className="mt-2 text-sm text-amber-200">
                  <p>
                    Payments are in test mode. No real transactions will be processed. 
                    Use test card <code className="bg-amber-900/50 px-1 rounded">4242 4242 4242 4242</code> with any future date and CVC.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
