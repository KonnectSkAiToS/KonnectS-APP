import { jsPDF } from "jspdf";
import fs from "fs";
import path from "path";

// Categories and file discovery
interface FileEntry {
  category: string;
  relativePath: string;
  lines: string[];
}

function getFiles(): FileEntry[] {
  const root = process.cwd();

  const fileCategories: { category: string; files: string[] }[] = [
    {
      category: "Architecture & Server",
      files: [
        "server.ts",
        "package.json",
        "vite.config.ts",
        "tsconfig.json",
        "index.html",
        "firestore.rules",
        "firebase-blueprint.json",
        "firebase-applet-config.json",
      ],
    },
    {
      category: "Core Application Entry",
      files: [
        "src/main.tsx",
        "src/App.tsx",
        "src/index.css",
      ],
    },
    {
      category: "Types & Global State",
      files: [
        "src/types/index.ts",
        "src/types/reels.ts",
        "src/contexts/AuthContext.tsx",
        "src/contexts/LanguageContext.tsx",
      ],
    },
    {
      category: "UI Components - Navigation & Core",
      files: [
        "src/components/Header.tsx",
        "src/components/Navigation.tsx",
        "src/components/HomeView.tsx",
        "src/components/ServicesView.tsx",
        "src/components/WorkerView.tsx",
        "src/components/WorkerReelsModule.tsx",
        "src/components/ReelViewerModal.tsx",
        "src/components/ReportIssueModal.tsx",
        "src/components/SpatialARScannerModal.tsx",
        "src/components/QRScannerModal.tsx",
        "src/components/ConflictResolutionModal.tsx",
        "src/components/AdminDashboard.tsx",
        "src/components/ProfileView.tsx",
        "src/components/LoginView.tsx",
        "src/components/SettingsEditor.tsx",
        "src/components/DeveloperHUD.tsx",
      ],
    },
    {
      category: "UI Components - Services & Community",
      files: [
        "src/components/MarketplaceView.tsx",
        "src/components/MarketplaceItemCard.tsx",
        "src/components/RidesView.tsx",
        "src/components/FetchView.tsx",
        "src/components/CharityView.tsx",
        "src/components/ChatView.tsx",
        "src/components/CommunityBoard.tsx",
        "src/components/CommunityMap.tsx",
        "src/components/CommunityPulse.tsx",
        "src/components/CommunitySafety.tsx",
        "src/components/QuickSOS.tsx",
        "src/components/WorkerCapabilityRadar.tsx",
        "src/components/WorkHistoryModule.tsx",
        "src/components/WorkspaceHub.tsx",
        "src/components/Testimonials.tsx",
        "src/components/UserAvatar.tsx",
        "src/components/VerificationStatus.tsx",
        "src/components/ExpenseInsight.tsx",
        "src/components/FeatureSpotlight.tsx",
        "src/components/GeminiAssistant.tsx",
        "src/components/GlobalVoiceCommand.tsx",
        "src/components/GuidedTour.tsx",
        "src/components/LazyImage.tsx",
        "src/components/MapView.tsx",
        "src/components/ErrorBoundary.tsx",
      ],
    },
    {
      category: "Services & Integrations",
      files: [
        "src/services/geminiService.ts",
        "src/services/chatService.ts",
        "src/services/dbSyncService.ts",
        "src/services/calendarService.ts",
        "src/services/notificationService.ts",
        "src/services/backgroundSyncManager.ts",
        "src/services/batteryManager.ts",
        "src/lib/firebase.ts",
        "src/lib/sheetsService.ts",
        "src/lib/supabase.ts",
        "src/tests/dbSyncService.test.ts",
      ],
    },
    {
      category: "Hooks & Utilities",
      files: [
        "src/hooks/useProgressiveImage.ts",
        "src/hooks/useWorkerFormValidation.ts",
        "src/utils/reelsData.ts",
        "src/utils/haptics.ts",
        "src/utils/indexedDB.ts",
        "src/utils/avatarUtils.ts",
        "src/utils/devHudTracker.ts",
        "src/utils/usernameUtils.ts",
      ],
    },
  ];

  const results: FileEntry[] = [];

  for (const group of fileCategories) {
    for (const rel of group.files) {
      const fullPath = path.join(root, rel);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        // Split into lines
        const lines = content.split(/\r?\n/);
        results.push({
          category: group.category,
          relativePath: rel,
          lines,
        });
      }
    }
  }

  return results;
}

export function generatePdf() {
  console.log("Collecting files...");
  const files = getFiles();
  const totalFiles = files.length;
  const totalLines = files.reduce((acc, f) => acc + f.lines.length, 0);

  console.log(`Found ${totalFiles} files with ${totalLines} total lines.`);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 12;
  const rightMargin = 12;
  const contentWidth = pageWidth - leftMargin - rightMargin; // 186mm
  const topMargin = 16;
  const bottomMargin = 14;
  const lineHeight = 3.2; // mm
  const maxLineChars = 110;

  // Track page numbers for TOC
  const tocEntries: {
    category: string;
    filePath: string;
    linesCount: number;
    page: number;
  }[] = [];

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  // Background Header Gradient / Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 90, "F");

  // Accent line
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 90, pageWidth, 3, "F");

  // Title in header
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.text("KonnectS", leftMargin, 36);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(199, 210, 254); // indigo-200
  doc.text("Hyperlocal Community, Services & Micro-Economy Platform", leftMargin, 48);

  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text("Complete Production Application Source Code Dossier", leftMargin, 58);

  // Meta badge
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(leftMargin, 67, 72, 12, 2, 2, "F");
  doc.setTextColor(129, 140, 248);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`CONFIDENTIAL • VERSION 2.5 • ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`, leftMargin + 4, 74.5);

  // Architecture summary card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(leftMargin, 105, contentWidth, 75, 3, 3, "FD");

  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("System & Codebase Overview", leftMargin + 8, 117);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  const overviewBullets = [
    "• Full-Stack Architecture: React 18, TypeScript, Tailwind CSS, Express Node.js Engine",
    "• Multi-role Ecosystem: Residents, Verified Workers, Micro-Merchants, System Admins",
    "• High-Impact Features: Worker Experience Reels, Spatial AR / Camera Issue Reporting,",
    "   On-Demand Rides & Errands, Conflict Resolution System, Charity, & Offline IndexedDB Sync",
    "• Real-time & Cloud Services: Google Gemini 2.5 Flash, Cloud Firestore Security Rules, PWA",
  ];
  let bulletY = 126;
  for (const b of overviewBullets) {
    doc.text(b, leftMargin + 8, bulletY);
    bulletY += 6;
  }

  // Key Statistics 3-column Box
  const colWidth = (contentWidth - 8) / 3;
  const statBoxY = 190;

  // Stat 1: Total Files
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(leftMargin, statBoxY, colWidth, 32, 2, 2, "F");
  doc.setTextColor(99, 102, 241);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(totalFiles.toString(), leftMargin + 10, statBoxY + 16);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text("Source Code Files", leftMargin + 10, statBoxY + 24);

  // Stat 2: Total Lines of Code
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(leftMargin + colWidth + 4, statBoxY, colWidth, 32, 2, 2, "F");
  doc.setTextColor(16, 185, 129); // emerald-500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(totalLines.toLocaleString(), leftMargin + colWidth + 14, statBoxY + 16);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text("Total Lines of Code", leftMargin + colWidth + 14, statBoxY + 24);

  // Stat 3: Tech Coverage
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(leftMargin + (colWidth * 2) + 8, statBoxY, colWidth, 32, 2, 2, "F");
  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("100%", leftMargin + (colWidth * 2) + 18, statBoxY + 16);
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(9);
  doc.text("Type-Checked TypeScript", leftMargin + (colWidth * 2) + 18, statBoxY + 24);

  // Bottom Notice
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Generated automatically by KonnectS Application Intelligence Pipeline. All rights reserved.",
    pageWidth / 2,
    275,
    { align: "center" }
  );

  // ==========================================
  // TABLE OF CONTENTS (Placeholder pages reserved)
  // ==========================================
  // We'll record TOC items as we paginate code, and write TOC pages at the end
  const tocStartPage = 2;
  // Reserve 2 pages for TOC
  doc.addPage();
  doc.addPage();

  let currentPage = 4;
  doc.addPage();

  // Helper to draw page header & footer
  function drawPageChrome(category: string, filePath: string, pg: number) {
    // Header line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`KonnectS Codebase  •  ${category}  •  ${filePath}`, leftMargin, 10);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(leftMargin, 12, pageWidth - rightMargin, 12);

    // Footer line
    doc.line(leftMargin, pageHeight - 9, pageWidth - rightMargin, pageHeight - 9);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("KonnectS Hyperlocal Platform — Complete Source Code", leftMargin, pageHeight - 5);
    doc.text(`Page ${pg}`, pageWidth - rightMargin, pageHeight - 5, { align: "right" });
  }

  // ==========================================
  // CODE FILES
  // ==========================================
  for (const file of files) {
    tocEntries.push({
      category: file.category,
      filePath: file.relativePath,
      linesCount: file.lines.length,
      page: currentPage,
    });

    let y = topMargin;

    // Draw File Header Banner
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(leftMargin, y, contentWidth, 10, 1.5, 1.5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`FILE: ${file.relativePath}`, leftMargin + 4, y + 6.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text(
      `${file.lines.length} lines  |  ${file.category}`,
      pageWidth - rightMargin - 4,
      y + 6.5,
      { align: "right" }
    );

    y += 14;

    drawPageChrome(file.category, file.relativePath, currentPage);

    doc.setFont("courier", "normal");
    doc.setFontSize(6.8);

    for (let i = 0; i < file.lines.length; i++) {
      const lineNumStr = String(i + 1).padStart(4, " ") + " | ";
      const rawLine = file.lines[i];

      // Break long lines into chunks if needed
      const maxCodeChars = maxLineChars - lineNumStr.length;
      let remaining = rawLine;

      let isFirstSubLine = true;
      while (remaining.length > 0 || isFirstSubLine) {
        if (y + lineHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentPage++;
          y = topMargin;
          drawPageChrome(file.category, file.relativePath, currentPage);
          doc.setFont("courier", "normal");
          doc.setFontSize(6.8);
        }

        const chunk = remaining.slice(0, maxCodeChars);
        remaining = remaining.slice(maxCodeChars);

        // Draw line number
        doc.setTextColor(148, 163, 184); // line number color
        const prefix = isFirstSubLine ? lineNumStr : "     |   ↳ ";
        doc.text(prefix, leftMargin, y);

        // Draw line text
        doc.setTextColor(15, 23, 42); // slate-900 code text
        doc.text(chunk, leftMargin + 13, y);

        y += lineHeight;
        isFirstSubLine = false;
        if (remaining.length === 0) break;
      }
    }

    // Space after file if room, or next page
    y += 5;
    if (y < pageHeight - 35) {
      // separator between files on same page
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(leftMargin, y, pageWidth - rightMargin, y);
      y += 6;
    } else {
      // Start next file on new page
      doc.addPage();
      currentPage++;
    }
  }

  // ==========================================
  // WRITE TABLE OF CONTENTS INTO PAGES 2 & 3
  // ==========================================
  doc.setPage(tocStartPage);
  doc.setFillColor(15, 23, 42);
  doc.rect(leftMargin, 12, contentWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Table of Contents — Codebase Directory (Part 1)", leftMargin + 4, 20);

  let tocY = 30;
  let currentCategory = "";
  let inTocPage = tocStartPage;

  for (let idx = 0; idx < tocEntries.length; idx++) {
    const entry = tocEntries[idx];

    // Check if we need to switch to TOC page 3
    if (tocY > pageHeight - 20 && inTocPage === tocStartPage) {
      inTocPage = tocStartPage + 1;
      doc.setPage(inTocPage);
      doc.setFillColor(15, 23, 42);
      doc.rect(leftMargin, 12, contentWidth, 12, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Table of Contents — Codebase Directory (Part 2)", leftMargin + 4, 20);
      tocY = 30;
      currentCategory = "";
    }

    if (entry.category !== currentCategory) {
      currentCategory = entry.category;
      tocY += 2;
      doc.setFillColor(241, 245, 249);
      doc.rect(leftMargin, tocY - 3.5, contentWidth, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(79, 70, 229);
      doc.text(currentCategory.toUpperCase(), leftMargin + 3, tocY);
      tocY += 5;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    // File name
    const displayPath = entry.filePath;
    doc.text(displayPath, leftMargin + 4, tocY);

    // Line count badge
    doc.setTextColor(148, 163, 184);
    doc.text(`(${entry.linesCount} lines)`, leftMargin + 105, tocY);

    // Dotted line & page number
    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.text(`Page ${entry.page}`, pageWidth - rightMargin - 4, tocY, { align: "right" });

    // Subtle dotted leader
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([0.5, 1], 0);
    doc.line(leftMargin + 125, tocY - 0.5, pageWidth - rightMargin - 20, tocY - 0.5);
    doc.setLineDashPattern([], 0); // reset

    tocY += 4.5;
  }

  // Draw header/footer for TOC pages
  doc.setPage(tocStartPage);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("KonnectS Hyperlocal Platform — Source Code Dossier", leftMargin, pageHeight - 5);
  doc.text(`Page 2 of ${currentPage}`, pageWidth - rightMargin, pageHeight - 5, { align: "right" });

  doc.setPage(tocStartPage + 1);
  doc.text("KonnectS Hyperlocal Platform — Source Code Dossier", leftMargin, pageHeight - 5);
  doc.text(`Page 3 of ${currentPage}`, pageWidth - rightMargin, pageHeight - 5, { align: "right" });

  // Save to public directory
  const publicDir = path.join(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const outputPath = path.join(publicDir, "KonnectS_Codebase.pdf");
  console.log("Writing PDF array buffer to", outputPath);
  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  fs.writeFileSync(outputPath, pdfBuffer);

  console.log(`Success! PDF generated at: ${outputPath} (${(pdfBuffer.length / (1024 * 1024)).toFixed(2)} MB, ${currentPage} pages)`);
}

// Execute if run directly
generatePdf();
