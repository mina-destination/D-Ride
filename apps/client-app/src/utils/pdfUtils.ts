import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export const shareTicketPdf = async (booking: any, user: any) => {
  try {
    // 1. Generate QR Code Data URL
    const tokenPayload = JSON.stringify({
      bookingId: booking._id,
      token: booking.qrVerificationToken || ''
    });
    
    const qrDataUrl = await QRCode.toDataURL(tokenPayload, {
      width: 256,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });

    // 2. Setup jsPDF Document (A6 Portrait: 105 x 148 mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a6'
    });

    // Background base
    doc.setFillColor(250, 250, 252);
    doc.rect(0, 0, 105, 148, 'F');

    // Header Banner
    doc.setFillColor(15, 15, 26); // Deep Space Dark Blue
    doc.rect(0, 0, 105, 32, 'F');

    // Amber stripe
    doc.setFillColor(245, 183, 49); // Golden Amber
    doc.rect(0, 31, 105, 1, 'F');

    // Boarding Number Badge
    if (booking.boardingNumber) {
      doc.setFillColor(245, 183, 49); // Golden Amber
      doc.rect(78, 8, 17, 8, 'F');
      doc.setTextColor(15, 15, 26); // Dark
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`#${booking.boardingNumber}`, 86.5, 13.5, { align: 'center' });
    }

    // Header Text
    doc.setTextColor(245, 183, 49);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('D-RIDE', 10, 13);

    doc.setTextColor(150, 150, 170);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('SMART TRANSIT BOARDING PASS', 10, 19);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.text(`TICKET ID: #${booking._id.toUpperCase()}`, 10, 25);

    // Body Layout
    doc.setTextColor(15, 15, 26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const routeName = booking.tripId?.routeId?.name || 'Standard Route';
    doc.text(routeName, 10, 42);

    // Subtle separator line
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    doc.line(10, 46, 95, 46);

    // Date and Time formatting
    const dateObj = booking.tripId?.departureTime ? new Date(booking.tripId.departureTime) : null;
    const formattedDate = dateObj ? dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
    const formattedTime = dateObj ? dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'N/A';

    // Info Grid helper function
    const drawLabelValue = (label: string, value: string, x: number, y: number) => {
      doc.setTextColor(110, 110, 125);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(label.toUpperCase(), x, y);

      doc.setTextColor(20, 20, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(value, x, y + 4.5);
    };

    // Row 1
    drawLabelValue('Passenger', user?.name || 'Rider', 10, 53);
    drawLabelValue('Fare', `${booking.amountEGP} EGP`, 60, 53);

    // Row 2
    drawLabelValue('Date', formattedDate, 10, 64);
    drawLabelValue('DepartureTime', formattedTime, 60, 64);

    // Row 3
    drawLabelValue('Seat', `#${booking.seatNumbers?.join(', ') || booking.seatNumber || 'N/A'}`, 10, 75);
    drawLabelValue('Status', booking.status || 'CONFIRMED', 60, 75);

    // Row 4 & 5 (Full Width to prevent text truncation)
    const pickup = booking.pickupCheckpoint?.name || 'Route Start';
    const driverName = booking.tripId?.driver?.name || 'Captain Ahmed';
    const vehicleInfo = booking.tripId?.vehicle 
      ? `${booking.tripId.vehicle.model}` 
      : 'Toyota HiAce';

    drawLabelValue('Boarding Point', pickup, 10, 86);
    drawLabelValue('Vehicle & Driver', `${vehicleInfo} (${driverName})`, 10, 97);

    // Divider before QR Code
    doc.line(10, 108, 95, 108);

    // QR Code Image
    doc.addImage(qrDataUrl, 'PNG', 39.5, 110, 26, 26);

    // Footer note
    doc.setTextColor(140, 140, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('PRESENT THIS QR CODE TO THE DRIVER WHEN BOARDING', 52.5, 139, { align: 'center' });
    doc.text('THANK YOU FOR RIDING WITH D-RIDE', 52.5, 143, { align: 'center' });

    // 3. Share or Save PDF
    const pdfBlob = doc.output('blob');
    const filename = `d-ride-ticket-${booking._id.slice(-6).toUpperCase()}.pdf`;
    const file = new File([pdfBlob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `D-Ride Boarding Pass`,
          text: `Here is my boarding pass for trip ${routeName}.`
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Sharing failed, falling back to download:', err);
          doc.save(filename);
        }
      }
    } else {
      // Fallback: Direct download
      doc.save(filename);
      alert('Web Share is not supported or does not support PDF sharing in this browser. The ticket has been downloaded as a PDF file.');
    }
  } catch (error) {
    console.error('Error generating PDF ticket:', error);
    alert('Failed to generate or share PDF ticket.');
  }
};
