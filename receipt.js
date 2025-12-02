// Receipt System for d'sis Catering
class ReceiptSystem {
    constructor() {
        this.receipts = this.loadReceipts();
        this.nextReceiptNumber = this.getNextReceiptNumber();
    }

    async generateReceipt(bookingData, menuItems) {
        try {
            // First create the booking
            const bookingResponse = await api.createBooking({
                eventType: bookingData.occasion,
                eventDate: bookingData.eventDate,
            timeSlot: bookingData.timeSlot,
                eventVenue: bookingData.eventVenue,
                numGuests: parseInt(bookingData.numGuests),
                specialInstructions: bookingData.instructions || '',
                // Include customer fields for compatibility with simple backend
                customerName: `${bookingData.firstName} ${bookingData.lastName}`.trim(),
                customerEmail: bookingData.email,
                customerPhone: bookingData.contactNumber || '',
                // Include offer tracking
                offerId: window.bookingOfferId || null,
                promoCode: window.appliedPromoCode ? window.appliedPromoCode.code : null,
                menuItems: menuItems.map(item => ({
                    itemId: item.id,
                    quantity: item.quantity
                }))
            });

            // Extract booking ID - handle both response formats
            const booking = bookingResponse.booking || bookingResponse;
            const bookingId = booking.id || booking.bookingId;

            if (!bookingId) {
                throw new Error('Booking ID not found in response');
            }

            // Then generate receipt for the booking
            const receiptResponse = await api.generateReceipt(bookingId, {
                paymentMethod: 'Cash/Card',
                paymentStatus: 'pending'
            });

            // Extract receipt - handle both response formats
            const receipt = receiptResponse.receipt || receiptResponse;
            
            if (!receipt) {
                throw new Error('Receipt not found in response');
            }

            return receipt;
        } catch (error) {
            console.error('Error generating receipt:', error);
            throw error;
        }
    }

    calculateSubtotal(menuItems) {
        return menuItems.reduce((total, item) => {
            return total + (item.price * item.quantity);
        }, 0);
    }

    generateReceiptId() {
        return 'RCP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    generateReceiptNumber() {
        const number = this.nextReceiptNumber++;
        return 'R' + number.toString().padStart(6, '0');
    }

    generateBookingId() {
        return 'BK-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    getNextReceiptNumber() {
        const maxNumber = this.receipts.reduce((max, receipt) => {
            const number = parseInt(receipt.receiptNumber.substring(1));
            return number > max ? number : max;
        }, 0);
        return maxNumber + 1;
    }

    displayReceipt(receipt) {
        const receiptHTML = this.generateReceiptHTML(receipt);

        try {
            if (receipt && receipt.receiptId) {
                const existing = this.receipts.find(r => r.receiptId === receipt.receiptId);
                if (!existing) {
                    this.receipts.push(receipt);
                    this.saveReceipts();
                }
            }
        } catch (e) {
        }

        const modal = document.createElement('div');
        modal.className = 'receipt-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 600px; width: 90%; max-height: 80%; overflow-y: auto; color: #000 !important;">
                ${receiptHTML}
                <div style="text-align: center; margin-top: 20px;">
                    <button onclick="this.closest('.receipt-modal').remove()" class="btn btn-secondary me-2">Close</button>
                    <button onclick="receiptSystem.printReceipt('${receipt.receiptId}')" class="btn btn-primary me-2">Print Receipt</button>
                    <button onclick="receiptSystem.downloadPDF('${receipt.receiptId}')" class="btn btn-success">Download PDF</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    generateReceiptHTML(receipt) {
        return `
            <div class="receipt" style="color: #000 !important;">
                <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
                    <h2 style="color: #000 !important; margin: 0; font-weight: bold;">d'sis Catering</h2>
                    <p style="margin: 5px 0; color: #333 !important;">Celebrating Life with Food</p>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #333 !important;">
                        San Lorenzo, Mexico, Pampanga, San Fernando, Philippines<br>
                        +63 908 342 2706 | dsis_catering28@yahoo.com
                    </p>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
                    <div>
                        <h4 style="color: #000 !important; margin-bottom: 10px;">Receipt #: ${receipt.receiptNumber}</h4>
                        <p style="color: #000 !important;"><strong>Date:</strong> ${receipt.issuedDate}</p>
                    </div>
                    <div>
                        <h4 style="color: #000 !important; margin-bottom: 10px;">Booking #: ${receipt.bookingId}</h4>
                        <p style="color: #000 !important;"><strong>Status:</strong> ${receipt.paymentStatus}</p>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #000 !important; margin-bottom: 10px;">Customer Information</h4>
                    <p style="color: #000 !important;"><strong>Name:</strong> ${receipt.customerName}</p>
                    <p style="color: #000 !important;"><strong>Email:</strong> ${receipt.customerEmail}</p>
                    <p style="color: #000 !important;"><strong>Phone:</strong> ${receipt.customerPhone}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #000 !important; margin-bottom: 10px;">Event Details</h4>
                    <p style="color: #000 !important;"><strong>Event Type:</strong> ${receipt.eventType}</p>
                    <p style="color: #000 !important;"><strong>Date:</strong> ${receipt.eventDate}</p>
                    <p style="color: #000 !important;"><strong>Venue:</strong> ${receipt.eventVenue}</p>
                    <p style="color: #000 !important;"><strong>Number of Guests:</strong> ${receipt.numGuests}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h4 style="color: #000 !important; margin-bottom: 10px;">Menu Items</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: left; color: #000 !important;">Item</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #000 !important;">Qty</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #000 !important;">Price</th>
                                <th style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #000 !important;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(receipt.items || receipt.menuItems || []).map(item => `
                                <tr>
                                    <td style="border: 1px solid #ddd; padding: 8px; color: #000 !important;">${item.itemName || item.item_name || item.name}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #000 !important;">${item.quantity}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #000 !important;">₱${Number((item.unitPrice ?? item.unit_price ?? item.price) || 0).toFixed(2)}</td>
                                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right; color: #000 !important;">₱${Number(((item.unitPrice ?? item.unit_price ?? item.price) || 0) * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <div style="border-top: 2px solid #333; padding-top: 20px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span style="color: #000 !important;"><strong>Subtotal:</strong></span>
                        <span style="color: #000 !important;"><strong>₱${Number(receipt.subtotal ?? receipt.totalAmount ?? 0).toFixed(2)}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 1.2em; font-weight: bold; border-top: 1px solid #ddd; padding-top: 10px;">
                        <span style="color: #000 !important;">Total Amount:</span>
                        <span style="color: #000 !important;">₱${Number(receipt.totalAmount ?? receipt.subtotal ?? 0).toFixed(2)}</span>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <p style="color: #333 !important; font-size: 0.9em;">
                        Thank you for choosing d'sis Catering!<br>
                        We look forward to making your event memorable.
                    </p>
                </div>
            </div>
        `;
    }

    printReceipt(receiptId) {
        const receipt = this.receipts.find(r => r.receiptId === receiptId);
        if (receipt) {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Receipt - ${receipt.receiptNumber}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
                            .receipt { max-width: 600px; margin: 0 auto; }
                            table { width: 100%; border-collapse: collapse; }
                            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                            th { background: #f8f9fa; }
                        </style>
                    </head>
                    <body>
                        ${this.generateReceiptHTML(receipt)}
                    </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }
    }

    async downloadPDF(receiptId) {
        try {
            const API_BASE_URL = 'http://localhost:3000/api';
            const token = localStorage.getItem('dsis_token');
            
            const response = await fetch(`${API_BASE_URL}/receipts/${receiptId}/pdf`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate PDF');
            }

            // Get the PDF blob
            const blob = await response.blob();
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `receipt-${receiptId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            console.log('PDF downloaded successfully');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF. Please try again.');
        }
    }

    loadReceipts() {
        const receipts = localStorage.getItem('dsis_receipts');
        return receipts ? JSON.parse(receipts) : [];
    }

    saveReceipts() {
        localStorage.setItem('dsis_receipts', JSON.stringify(this.receipts));
    }

    getReceiptsByUser(userId) {
        return this.receipts.filter(receipt => receipt.customerEmail === userId);
    }

    getAllReceipts() {
        return this.receipts;
    }
}

// Initialize receipt system
const receiptSystem = new ReceiptSystem();

// Export for use in other scripts
window.receiptSystem = receiptSystem;
