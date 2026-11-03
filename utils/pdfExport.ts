import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfTableConfig {
  title?: string;
  headers: string[];
  data: (string | number)[][];
}

export interface ExportPdfOptions {
  title: string;
  subtitle?: string;
  filters?: string;
  filename: string;
  orientation?: 'portrait' | 'landscape';
  tables?: PdfTableConfig[];
  headers?: string[];
  rows?: (string | number)[][];
  data?: (string | number)[][];
}

export function exportPdfReport({
  title,
  subtitle,
  filters,
  filename,
  orientation = 'landscape',
  tables,
  headers,
  rows,
  data,
}: ExportPdfOptions) {
  try {
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const dataHoraStr = `${d}/${m}/${y} ${h}:${min}:${s}`;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Top Institutional Header
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SAL – Sistema de Análise de Leitura', 14, 10);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`Emissão: ${dataHoraStr}`, pageWidth - 14, 10, { align: 'right' });

    doc.setTextColor(56, 189, 248); // sky-400
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(String(title || 'RELATÓRIO').toUpperCase(), 14, 17);

    let currentY = 28;

    // Subtitle / Filters info box
    if (subtitle || filters) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(226, 232, 240); // slate-200
      const boxHeight = subtitle && filters ? 15 : 9;
      doc.roundedRect(14, currentY, pageWidth - 28, boxHeight, 2, 2, 'FD');

      if (subtitle) {
        doc.setTextColor(30, 41, 59); // slate-800
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(subtitle, 18, currentY + 5.5);
      }

      if (filters) {
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(filters, 18, currentY + (subtitle ? 11 : 6));
      }

      currentY += boxHeight + 6;
    }

    // Determine normalized tables array
    const normalizedTables: PdfTableConfig[] = [];
    if (tables && tables.length > 0) {
      normalizedTables.push(...tables);
    } else if (headers && (rows || data)) {
      normalizedTables.push({
        headers,
        data: rows || data || [],
      });
    }

    // Draw tables sequentially
    normalizedTables.forEach((table) => {
      if (!table.data || table.data.length === 0) return;

      if (table.title) {
        if (currentY > pageHeight - 35) {
          doc.addPage();
          currentY = 20;
        }
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text(table.title, 14, currentY);
        currentY += 4;
      }

      autoTable(doc, {
        head: [table.headers],
        body: table.data,
        startY: currentY,
        margin: { left: 14, right: 14, bottom: 20 },
        theme: 'grid',
        styles: {
          fontSize: 7,
          cellPadding: 1.8,
          textColor: [30, 41, 59],
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
          font: 'helvetica',
          overflow: 'linebreak',
        },
        headStyles: {
          fillColor: [30, 58, 138], // blue-900
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          halign: 'center',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        didDrawPage: (data) => {
          // Footer on every page
          const pNum = data.pageNumber;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(
            'Copyright SAL: Sistema de Análise de Leitura © 2026 | Criado por Thiago Marques Lopes',
            14,
            pageHeight - 8
          );
          doc.text(`Página ${pNum}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
        },
      });

      // Update currentY for next table
      const lastAutoTable = (doc as any).lastAutoTable;
      if (lastAutoTable) {
        currentY = lastAutoTable.finalY + 10;
      }
    });

    const cleanFilename = (filename || 'relatorio_sal').replace(/[/\\?%*:|"<>]/g, '_');
    const finalFilename = cleanFilename.endsWith('.pdf') ? cleanFilename : `${cleanFilename}.pdf`;
    doc.save(finalFilename);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
  }
}
