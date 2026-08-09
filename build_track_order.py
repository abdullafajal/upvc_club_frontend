import re
import os

with open("/Users/aqib/work/upvc_club_frontend/index.html", "r") as f:
    index_html = f.read()

# Extract header and footer from index.html
header_match = re.search(r"(.*?)<!-- Main Content -->", index_html, re.DOTALL)
footer_match = re.search(r"<!-- Footer -->(.*)", index_html, re.DOTALL)

header = header_match.group(1) if header_match else ""
footer = "<!-- Footer -->" + footer_match.group(1) if footer_match else ""

TRACK_ORDER_CONTENT = """
<!-- Main Content -->
<main class="flex-grow pt-20">
    <div class="min-h-screen bg-gray-50 flex flex-col items-center pb-10 px-4">
        
        <!-- Search Section -->
        <div class="w-full max-w-2xl text-center mb-10 animate-fade-in mt-10">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">Track Your Order</h1>
            <p class="text-gray-500 mb-8">Enter your Order Number (ORD-...) or Quotation Number (QT-...) to see live status.</p>
            
            <form id="track-form" class="relative max-w-lg mx-auto" onsubmit="handleTrackFormSubmit(event)">
                <input type="text" id="track-query" name="q"
                       class="w-full pl-12 pr-4 py-4 rounded-full border border-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all shadow-sm text-lg"
                       placeholder="e.g. ORD-202402-0001" required autofocus>
                <span class="material-icons-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-2xl">search</span>
                <button type="submit" class="absolute right-2 top-2 bottom-2 bg-primary text-white px-6 rounded-full font-medium hover:bg-primary-dark transition-colors shadow-md flex items-center gap-2">
                    <span id="track-btn-text">Track</span>
                    <span id="track-btn-spinner" class="material-icons-outlined animate-spin hidden">sync</span>
                </button>
            </form>
            
            <div id="track-error-container" class="hidden mt-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 flex items-center justify-center gap-2 animate-shake">
                <span class="material-icons-outlined">error_outline</span> <span id="track-error-message"></span>
            </div>
        </div>

        <!-- Order Result Container -->
        <div id="order-result" class="w-full max-w-4xl bg-white rounded-3xl shadow-elevation-2 overflow-hidden animate-slide-up hidden">
            <!-- Header -->
            <div class="bg-primary/5 p-6 border-b border-gray-100 flex flex-wrap justify-between items-center gap-4">
                <div>
                    <span class="text-xs font-bold tracking-wider text-primary uppercase mb-1 block">Order Details</span>
                    <h2 id="order-number" class="text-2xl font-bold text-gray-900"></h2>
                    <div class="flex items-center gap-2 text-sm text-gray-500 mt-1">
                        <span class="material-icons-outlined text-sm">calendar_today</span>
                        <span>Placed on <span id="order-placed-date"></span></span>
                    </div>
                </div>
                <div class="text-right">
                    <span class="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">Customer</span>
                    <p id="customer-name" class="font-semibold text-gray-900"></p>
                    <p id="customer-company" class="text-xs text-gray-500 hidden"></p>
                </div>
            </div>

            <!-- Progress Stepper -->
            <div class="p-8 lg:p-12 overflow-x-auto">
                <div class="relative min-w-[600px]">
                    <!-- Connecting Line -->
                    <div class="absolute top-6 left-0 w-full h-1 bg-gray-100 rounded-full"></div>
                    <div id="stepper-progress-line" class="absolute top-6 left-0 h-1 bg-primary rounded-full transition-all duration-1000 ease-out" style="width: 0%;"></div>

                    <!-- Steps Container -->
                    <div id="stepper-container" class="relative flex justify-between">
                        <!-- Dynamically populated steps -->
                    </div>
                </div>
            </div>

            <!-- Order Summary -->
            <div class="bg-gray-50 p-8 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-8">
                <!-- Left: Dates & Info -->
                <div class="space-y-4">
                    <h3 class="font-bold text-gray-900 flex items-center gap-2">
                        <span class="material-icons-outlined text-gray-400">event</span> Timeline Info
                    </h3>
                    <div class="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                        <div class="flex justify-between text-sm">
                            <span class="text-gray-500">Order Placed</span>
                            <span id="summary-placed-date" class="font-medium"></span>
                        </div>
                        <div id="summary-expected-container" class="flex justify-between text-sm hidden">
                            <span class="text-gray-500">Expected Delivery</span>
                            <span id="summary-expected-date" class="font-medium text-primary"></span>
                        </div>
                        <div id="summary-completed-container" class="flex justify-between text-sm pt-2 border-t border-gray-100 hidden">
                            <span class="text-gray-500">Completed On</span>
                            <span id="summary-completed-date" class="font-medium text-green-600"></span>
                        </div>
                    </div>
                </div>

                <!-- Right: Items Summary -->
                <div>
                    <h3 class="font-bold text-gray-900 flex items-center gap-2 mb-4">
                        <span class="material-icons-outlined text-gray-400">list_alt</span> Items Summary
                    </h3>
                    <div class="space-y-3">
                        <div id="items-list-container">
                            <!-- Items populated here -->
                        </div>
                        <p id="items-more-text" class="text-xs text-center text-gray-500 italic hidden"></p>
                    </div>
                </div>
            </div>
            
            <!-- Action Footer -->
            <div class="p-6 border-t border-gray-100 flex justify-center">
                <a id="order-pdf-link" href="#" class="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-medium transition-colors" target="_blank">
                    <span class="material-icons-outlined">download</span> Download Quotation PDF
                </a>
            </div>
        </div>

        <!-- Quotation Result Container -->
        <div id="quotation-result" class="w-full max-w-2xl bg-white rounded-3xl shadow-elevation-2 p-8 text-center animate-slide-up hidden">
            <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span class="material-icons-outlined text-3xl">description</span>
            </div>
            <h2 class="text-2xl font-bold text-gray-900 mb-2">Quotation Found</h2>
            <p class="text-gray-500 mb-6">Status: <span id="quotation-status" class="uppercase tracking-wide font-bold text-blue-600"></span></p>
            
            <div class="bg-blue-50/50 rounded-xl p-6 mb-8 text-left border border-blue-100">
                <p class="text-sm text-gray-600 mb-2"><strong>Quotation #:</strong> <span id="quotation-number"></span></p>
                <p class="text-sm text-gray-600 mb-2"><strong>Date:</strong> <span id="quotation-date"></span></p>
                <p class="text-sm text-gray-600"><strong>Note:</strong> Work on your order will begin once this quotation is approved and converted to an order.</p>
            </div>

            <a id="quotation-pdf-link" href="#" class="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary-dark transition-colors" target="_blank">
                <span class="material-icons-outlined">download</span> Download Quotation
            </a>
        </div>

    </div>
</main>

<style>
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
    
    .animate-fade-in { animation: fade-in 0.6s ease-out; }
    .animate-slide-up { animation: slide-up 0.6s ease-out; }
    .animate-shake { animation: shake 0.4s ease-in-out; }
</style>

<script>
async function handleTrackFormSubmit(e) {
    e.preventDefault();
    const query = document.getElementById('track-query').value.trim();
    if (!query) return;

    // Reset UI state
    document.getElementById('track-error-container').classList.add('hidden');
    document.getElementById('order-result').classList.add('hidden');
    document.getElementById('quotation-result').classList.add('hidden');
    
    const btnText = document.getElementById('track-btn-text');
    const btnSpinner = document.getElementById('track-btn-spinner');
    
    btnText.textContent = "Tracking...";
    btnSpinner.classList.remove('hidden');

    // Fetch data
    const data = await fetchTrackingData(query);
    
    btnText.textContent = "Track";
    btnSpinner.classList.add('hidden');

    if (data.error) {
        document.getElementById('track-error-message').textContent = data.error;
        document.getElementById('track-error-container').classList.remove('hidden');
        return;
    }

    // Determine host for API_BASE_URL resolution
    const apiHost = API_BASE_URL.replace('/api', '');

    if (data.type === "order") {
        document.getElementById('order-number').textContent = data.order_number;
        document.getElementById('order-placed-date').textContent = data.dates.placed;
        
        if (data.customer) {
            document.getElementById('customer-name').textContent = data.customer.contact_person;
            if (data.customer.company_name) {
                document.getElementById('customer-company').textContent = data.customer.company_name;
                document.getElementById('customer-company').classList.remove('hidden');
            } else {
                document.getElementById('customer-company').classList.add('hidden');
            }
        }

        // Render Stepper
        const stepperContainer = document.getElementById('stepper-container');
        stepperContainer.innerHTML = '';
        
        let currentStepIndex = -1;
        data.timeline_steps.forEach((step, index) => {
            if (step.is_current) currentStepIndex = index;
        });

        // Determine line width
        const totalSteps = data.timeline_steps.length;
        const progressWidth = totalSteps > 1 && currentStepIndex >= 0 
            ? (currentStepIndex / (totalSteps - 1)) * 100 
            : 0;
        document.getElementById('stepper-progress-line').style.width = `${progressWidth}%`;

        data.timeline_steps.forEach(step => {
            const isPast = step.is_completed && !step.is_current;
            const isCurrent = step.is_current;
            
            let iconClasses = "bg-white border-gray-200 text-gray-300";
            if (isPast) iconClasses = "bg-primary border-primary text-white";
            if (isCurrent) iconClasses = "bg-white border-primary text-primary shadow-lg scale-110";

            let labelClasses = (isPast || isCurrent) ? "text-gray-900" : "text-gray-400";
            
            const currentBadge = isCurrent 
                ? '<span class="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-[10px] uppercase font-bold rounded-md">Current</span>' 
                : '';
            
            const dateStr = step.date ? `<p class="text-[10px] text-gray-500 mt-1 font-medium">${step.date}</p>` : '';

            const stepHtml = `
                <div class="flex flex-col items-center group relative z-10" style="width: 100px;">
                    <div class="w-12 h-12 rounded-full flex items-center justify-center border-4 transition-all duration-500 ${iconClasses}">
                        <span class="material-icons-outlined text-xl">${step.icon}</span>
                    </div>
                    <div class="mt-4 text-center">
                        <p class="text-sm font-semibold whitespace-nowrap transition-colors ${labelClasses}">
                            ${step.label}
                        </p>
                        ${dateStr}
                        ${currentBadge}
                    </div>
                </div>
            `;
            stepperContainer.innerHTML += stepHtml;
        });

        // Order Summary
        document.getElementById('summary-placed-date').textContent = data.dates.placed;
        
        if (data.dates.expected_delivery) {
            document.getElementById('summary-expected-date').textContent = data.dates.expected_delivery;
            document.getElementById('summary-expected-container').classList.remove('hidden');
        } else {
            document.getElementById('summary-expected-container').classList.add('hidden');
        }
        
        if (data.dates.completed) {
            document.getElementById('summary-completed-date').textContent = data.dates.completed;
            document.getElementById('summary-completed-container').classList.remove('hidden');
        } else {
            document.getElementById('summary-completed-container').classList.add('hidden');
        }

        // Items
        const itemsContainer = document.getElementById('items-list-container');
        itemsContainer.innerHTML = '';
        
        const displayItems = data.items.slice(0, 3);
        displayItems.forEach(item => {
            const dimStr = (item.width && item.height) ? ` • ${item.width}' × ${item.height}'` : '';
            itemsContainer.innerHTML += `
                <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
                    <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                        <span class="material-icons-outlined text-lg">window</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">${item.description}</p>
                        <p class="text-xs text-gray-500">${item.quantity} ${item.unit}${dimStr}</p>
                    </div>
                </div>
            `;
        });
        
        const moreText = document.getElementById('items-more-text');
        if (data.items.length > 3) {
            moreText.textContent = `+ ${data.items.length - 3} more items`;
            moreText.classList.remove('hidden');
        } else {
            moreText.classList.add('hidden');
        }

        if (data.pdf_url) {
            document.getElementById('order-pdf-link').href = apiHost + data.pdf_url;
            document.getElementById('order-pdf-link').classList.remove('hidden');
        } else {
            document.getElementById('order-pdf-link').classList.add('hidden');
        }

        document.getElementById('order-result').classList.remove('hidden');
    } else if (data.type === "quotation") {
        document.getElementById('quotation-status').textContent = data.status_display;
        document.getElementById('quotation-number').textContent = data.quote_number;
        document.getElementById('quotation-date').textContent = data.date;
        
        if (data.pdf_url) {
            document.getElementById('quotation-pdf-link').href = apiHost + data.pdf_url;
            document.getElementById('quotation-pdf-link').classList.remove('hidden');
        } else {
            document.getElementById('quotation-pdf-link').classList.add('hidden');
        }

        document.getElementById('quotation-result').classList.remove('hidden');
    }
}

// Auto-run if 'q' is in URL
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (query) {
        document.getElementById('track-query').value = query;
        // Small timeout to allow api.js load
        setTimeout(() => {
            const form = document.getElementById('track-form');
            if (form) form.dispatchEvent(new Event('submit'));
        }, 100);
    }
});
</script>
"""

with open("/Users/aqib/work/upvc_club_frontend/track-order.html", "w") as f:
    f.write(header + TRACK_ORDER_CONTENT + footer)
