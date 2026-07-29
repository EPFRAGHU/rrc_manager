/**
 * StarAdmin-2 RRC Manager Web Application Logic
 * Connected to Supabase Backend
 */

const SUPABASE_URL = 'https://hdyojqbsbtptbsohgwlg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkeW9qcWJzYnRwdGJzb2hnd2xnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzMzMzNjEsImV4cCI6MjA5OTkwOTM2MX0.95b7QbRS0nXTwTLsbtu2PhD7veehe8KQFWhaPCV-_RU';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Application State
let appData = {
  master: [],
  recoveryLog: [],
  fullyRecoveredLog: [],
  currentMode: 'Est Code',
  currentOptions: [],
  matchedGroups: [],
  activeEstId: null,
  activeAccHist: null
};

// Formatting helpers
function fmtCur(num) {
  const v = parseFloat(num) || 0;
  return '₹ ' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cleanStr(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  if (s.endsWith('.0')) s = s.slice(0, -2);
  return s === 'nan' ? '' : s;
}

const APP_VERSION = 'v2.9.1';

const APP_RELEASE_LOG = [
  {
    version: 'v2.9.1',
    date: '2026-07-30',
    title: 'Inline Payment Receipt Edit via Top Deposit Form (No Modal Popup)',
    changes: [
      'Updated Edit button action to populate the existing top payment entry form directly above the ledger table.',
      'Replaced separate popup window with inline Update button and Cancel button in the entry form.',
      'Highlighted top entry form with active edit border while editing existing deposit amounts.'
    ]
  },
  {
    version: 'v2.9.0',
    date: '2026-07-30',
    title: 'Payment Receipt Record Edit Functionality across Establishment Ledgers',
    changes: [
      'Added Edit button to Date-Wise Payment Receipts Ledger table before the Delete button.',
      'Added Edit Payment Receipt Modal (editReceiptModal) supporting payment date, receipt/challan no, and 5-account deposit edits.',
      'Implemented updateReceiptEntry to sync edited payment records directly to Supabase recovery_log and recalculate rrc_master balances.'
    ]
  },
  {
    version: 'v2.8.2',
    date: '2026-07-30',
    title: 'Triple-Failsafe Railway & Supabase Live Payment Deletion Engine Fix',
    changes: [
      'Fixed timestamp string key mismatch in buildReceiptLedgerSection and deleteReceiptGroup on live Supabase datasets.',
      'Added triple-failsafe Supabase deletion (by txn_id, by primary key array .in("id", ...), and by property criteria).',
      'Added error logging for Supabase delete responses to guarantee complete database record removal on Railway app.'
    ]
  },
  {
    version: 'v2.8.1',
    date: '2026-07-30',
    title: 'Added Period of Default & Total Payment Received across PDF Reports',
    changes: [
      'Added "Total Payment Received (Rs.)" column across all PDF exports (Top Defaulters, EO Pending List, Ageing Year Drill-Down, Action Taken).',
      'Ensured Period of Default is included alongside RRC number and establishment metrics in all report exports.',
      'Updated PDF autoTable column metric alignment for right-aligned monetary numbers across all PDF modules.'
    ]
  },
  {
    version: 'v2.8.0',
    date: '2026-07-30',
    title: 'Robust Multi-Row Receipt Deletion & Supabase Database Sync Fix',
    changes: [
      'Fixed payment deletion (deleteReceiptGroup) for legacy and multi-account payment receipts in recovery_log.',
      'Now deletes all matching account records by primary key IDs (.in("id", ...)) and txn_id in Supabase.',
      'Normalized date string parsing to ensure exact key matching across ISO timestamps and YYYY-MM-DD values.',
      'Recalculated establishment account balances and synced fully_recovered status back to Supabase rrc_master instantly.'
    ]
  },
  {
    version: 'v2.7.9',
    date: '2026-07-30',
    title: 'Instant Day-to-Date Payment Receipt Entry & Deletion Refresh Fix',
    changes: [
      'Fixed payment receipt recording (saveReceiptEntry) and deletion (deleteReceiptGroup) when opened via popup modals.',
      'Added refreshEstablishmentCardView smart refresh engine to update both Quick Establishment Ledger modal and Search tab simultaneously.',
      'Scoped form element lookups to active popup containers to avoid ID collision.',
      'Escaped transaction keys in deleteReceiptGroup onclick handler to handle special characters cleanly.'
    ]
  },
  {
    version: 'v2.7.8',
    date: '2026-07-30',
    title: 'Full-Dataset Multi-Column Sorting for Top Defaulters & Paginated Modals',
    changes: [
      'Top Defaulters Watchlist table header sorting now sorts ALL records in the module dataset, not just the single page.',
      'Default initial sort order set to Pending Amount (Highest Dues first) for Top Defaulters Watchlist.',
      'Added interactive column header sorting (Ascending/Descending) to EST Code, Establishment Name, Type, RRC No, Period, District, Total Dues OB, and Pending Amount.',
      'CSV and PDF exports now respect the active full-dataset sort order selected by the user.',
      'Applied full-dataset column header sorting to EO Pending RRC List and Ageing Year Drill-Down modals.'
    ]
  },
  {
    version: 'v2.7.7',
    date: '2026-07-27',
    title: 'Login Page Script Syntax Fix & Auto-Recovery',
    changes: [
      'Fixed missing closing bracket syntax error in login.html keydown listener.',
      'Restored login form interactivity and form submission.'
    ]
  },
  {
    version: 'v2.7.6',
    date: '2026-07-27',
    title: 'Instant Anti-FOUC Authentication Shield',
    changes: [
      'Added synchronous pre-render auth guard in head of index.html to prevent flash of unauthenticated dashboard content.',
      'Hidden body by default until Supabase session verification finishes.',
      'Added auto-redirect on login.html if user is already authenticated.'
    ]
  },
  {
    version: 'v2.7.5',
    date: '2026-07-27',
    title: 'Enhanced Web Server CORS & Railway Healthcheck Endpoints',
    changes: [
      'Updated web_server.py with custom request handler supporting CORS headers for cross-origin DNS/proxy requests.',
      'Added dedicated /health and /ping endpoints for Railway proxy health checks.',
      'Configured Cache-Control and OPTIONS preflight handling for enterprise proxy compatibility.'
    ]
  },
  {
    version: 'v2.7.4',
    date: '2026-07-27',
    title: 'GitHub Pages Deployment Support & Root Fallback',
    changes: [
      'Added root index.html redirect to enable seamless GitHub Pages deployment.',
      'Created GitHub Actions workflow for automated deployments to epfraghu.github.io/rrc_manager/.',
      'Provides standard HTTPS domain resolution to bypass office DNS/firewall restrictions.'
    ]
  },
  {
    version: 'v2.7.3',
    date: '2026-07-27',
    title: 'Period of Default Added to All RRC List Popups & PDF Exports',
    changes: [
      'Added "Period" column after "RRC No" in all three RRC list popup modals.',
      'Applies to: Top Defaulters Watchlist, EO Filter RRCs, and Ageing Year Drill-Down.',
      'Period column also added to all CSV exports and PDF exports for these three modules.',
      'Period now appears after RRC No. in every table row and exported report.'
    ]
  },
  {
    version: 'v2.7.2',
    date: '2026-07-27',
    title: 'Action Taken Dropdown & Full Auto-Save on All Fields',
    changes: [
      'Added "Action Taken" dropdown to every certificate card with 5 stage options.',
      'Options: Notice/Under Recovery Process, CP-1 Issued, Before CP-1 Estt Deposited, CP-1 & CP-5 Issued, Fully Recovered.',
      'All case panel fields now auto-save to Supabase instantly on change — no manual save button needed.',
      'Inline \"✓ Data Saved Successfully\" green badge appears on the card after every save.',
      'Error states shown inline with red badge if Supabase update fails.',
      'Data persists to Supabase and repopulates on every subsequent page load.'
    ]
  },
  {
    date: '2026-07-27',
    title: 'IR / NIR Legal Case Tracking per Certificate',
    changes: [
      'Added IR / NIR case type field to every RRC certificate card.',
      'IR (In Roll) is the default for all establishments with no legal challenge.',
      'Selecting NIR reveals: Court/Forum (High Court, CGIT, etc.), Case No, and Case Filing Date.',
      'All four fields saved to Supabase rrc_master (case_type, court_forum, case_no, case_date).',
      'NIR records show a yellow info badge summarising the court, case number and date.',
      'Added 4 new columns to rrc_master via DB migration.'
    ]
  },
  {
    changes: [
      'Added a full-screen glassmorphism login page (login.html) with Supabase Auth integration.',
      'Auth guard added to app.js — unauthenticated users are redirected to login page automatically.',
      'Logged-in user email is displayed in the top navbar as a green user badge.',
      'Logout button added to the top navbar — clears Supabase session and redirects to login.',
      'Credentials stored securely in Supabase Auth (bcrypt-encrypted passwords, email-confirmed).'
    ]
  },
  {
    version: 'v2.5.4',
    date: '2026-07-26',
    title: 'EO Filter RRCs Bug Fix',
    changes: [
      'Fixed "Filter RRCs" button on EO dashboard cards not showing any records.',
      'filterByEo() now switches to Establishment tab automatically before populating results.',
      'Dropdown now shows ALL establishments assigned to the selected EO (not just the first one).',
      'First establishment is auto-selected so records appear immediately on click.'
    ]
  },
  {
    version: 'v2.6.6',
    date: '2026-07-26',
    title: 'PDF Export — Full Report from All Pages',
    changes: [
      'PDF export in paginated modals now generates the report from the complete data array, not just the current page.',
      'Added generateDataPdf() engine — data-driven PDF that bypasses the DOM entirely.',
      'Applies to: Top Defaulters Watchlist, EO Filter RRCs, and Ageing Year Drill-Down PDFs.',
      'Includes proper Page X of N two-pass footer numbering.',
      'CSV exports were already correct (they always used full data arrays).'
    ]
  },
  {
    version: 'v2.6.5',
    date: '2026-07-26',
    title: 'Compact Modal + Fixed Pagination Footer',
    changes: [
      'Reduced modal height from 92vh to 80vh for a compact fit around 10 records.',
      'Pagination bar (First/Prev/Page/Next/Last) is now fixed at the bottom of the popup window.',
      'Navigation bar no longer scrolls with table content — it stays locked in place at all times.',
      'Modal body scrolls independently while header and pagination footer remain static.'
    ]
  },
  {
    version: 'v2.6.4',
    date: '2026-07-26',
    title: 'Fixed-Height Modal Window — No More Resizing',
    changes: [
      'Changed modal container from max-height to a fixed height: 92vh so the popup stays the same size on every page.',
      'Modal body now uses flex: 1 with min-height: 0 so content scrolls inside the fixed window.',
      'Prevents the annoying resize/jump between paginated pages with different row counts.'
    ]
  },
  {
    version: 'v2.6.3',
    date: '2026-07-26',
    title: 'Wider Popups — Single-Row Columns with 2-Line Establishment Name',
    changes: [
      'Modal container widened to 99% of screen / 1600px max for maximum horizontal space.',
      'All table columns now use white-space:nowrap to stay in a single row.',
      'Establishment Name column gets a dedicated 2-line clamp (max 2 lines, 160-260px width).',
      'Cell padding and font slightly reduced to fit all columns comfortably.',
      'Applies globally to all popup RRC tables via CSS classes.'
    ]
  },
  {
    version: 'v2.6.2',
    date: '2026-07-26',
    title: 'Paginated Navigation in All RRC List Popups',
    changes: [
      'Added First / Prev / Page X of N / Next / Last navigation bar to all RRC list modals.',
      'Each page shows 10 records; global serial numbers are preserved across pages.',
      'Pagination applies to: Top Defaulters Watchlist, EO Filter RRCs, and Ageing Year Drill-Down.',
      'Pagination bar is hidden automatically when total records fit on one page.',
      'CSV and PDF exports always include ALL records regardless of current page.'
    ]
  },
  {
    version: 'v2.6.1',
    date: '2026-07-26',
    title: 'Ageing Analysis — Year Drill-Down RRC List',
    changes: [
      'Each year row in the RRC Ageing & Vintage modal is now a clickable hyperlink.',
      'Clicking a year (e.g. 2026) opens a full drill-down popup listing all RRC certificates for that year.',
      'Drill-down table shows: Sl.No, EST Code, Est Name, Type, RRC No, District, Enforcement Officer, Dues OB, Recovered, Pending.',
      'Added age bucket color badges (Fresh / 1-3 Yrs / 3-5 Yrs / Legacy 5+) on each year row.',
      'Added Export CSV and Export PDF buttons on the drill-down modal.',
      'Clicking any row or Open button navigates directly into that establishment ledger.'
    ]
  },
  {
    version: 'v2.6.0',
    date: '2026-07-26',
    title: 'Larger Popup Modals — Bigger Window & Fonts',
    changes: [
      'Increased all RRC report modal width from 960px to 1400px (96% of screen) for maximum readability.',
      'Increased modal max-height from 85vh to 92vh for taller content area.',
      'Table header font size increased from 11px to 14px; table cell font size from 13px to 15px.',
      'Table header and cell padding increased for better spacing.',
      'Modal title h3 font size increased from 18px to 22px.',
      'Modal subtitle font size increased from 12px to 14px across all report popups.',
      'Applies to: Top Defaulters, EO Filter, EO History, District, RO, Ageing, Action, Mode, Account Split, Monthly, Fully Recovered.'
    ]
  },
  {
    version: 'v2.5.9',
    date: '2026-07-26',
    title: 'Top Defaulters Watchlist — Sort by Establishment Name',
    changes: [
      'Changed Top Defaulters Watchlist modal default sort from highest pending amount to alphabetical by Establishment Name.',
      'CSV export also now sorted alphabetically by establishment name.',
      'Removed artificial top-50/top-100 row limit — all records now shown in both modal and CSV export.'
    ]
  },
  {
    version: 'v2.5.8',
    date: '2026-07-26',
    title: 'EO Filter Modal — Sort by Establishment Name',
    changes: [
      'Changed EO Filter RRCs modal default sort from highest pending amount to alphabetical by Establishment Name.',
      'CSV export also now sorted alphabetically by establishment name to match modal order.'
    ]
  },
  {
    version: 'v2.5.7',
    date: '2026-07-26',
    title: 'PDF Footer Page Count Fix (Two-Pass Stamping)',
    changes: [
      'Fixed PDF footer showing Page 1 of 1, Page 2 of 2 instead of correct total page count.',
      'Implemented two-pass page numbering: autoTable draws pages, then post-process stamps correct Page X of N on all pages.',
      'Fix applies globally to all PDF exports: EO Filter, Defaulters, District, RO, Ageing, Monthly, and all others.'
    ]
  },
  {
    version: 'v2.5.6',
    date: '2026-07-26',
    title: 'EO RRC Filter PDF Export Fix',
    changes: [
      'Fixed \'Report table not found\' error when clicking Export PDF on the EO RRC Filter modal.',
      'Corrected generateReportPdf() call to pass the modal body container ID instead of the table ID.'
    ]
  },
  {
    version: 'v2.5.5',
    date: '2026-07-26',
    title: 'EO Filter RRCs — Dedicated Popup Modal with Export',
    changes: [
      'Filter RRCs button on EO cards now opens a dedicated popup modal (matching Top Defaulters Watchlist style).',
      'Modal shows all pending RRCs for the selected EO sorted by highest pending amount.',
      'Added Export CSV and Export PDF buttons to the EO RRC filter modal.',
      'Clicking any row or Open button in the modal navigates directly to that establishment ledger.'
    ]
  },
  {
    version: 'v2.5.3',
    date: '2026-07-26',
    title: 'Precision PDF Font Metrics & Cell Alignment Fix',
    changes: [
      'Fixed PDF export monetary text cell overflow by converting Unicode Rupee glyph (₹) to standard Rs. for exact font width metrics.',
      'Optimized AutoTable cell padding (1.8mm) and overflow linebreaks to keep all financial amounts 100% inside cell borders.',
      'Expanded page margins (10mm left/right) for optimal table readability across portrait and landscape reports.'
    ]
  },
  {
    version: 'v2.5.2',
    date: '2026-07-26',
    title: 'Interactive Release History & Build Changelog Popup Modal',
    changes: [
      'Added interactive Version Badge click handler on header navbar to open release log popup.',
      'Built full chronological Release History Modal with features list, build dates, and CSV export.',
      'Enforced automatic version and subversion incrementing rule in workspace guidelines.'
    ]
  },
  {
    version: 'v2.5.1',
    date: '2026-07-26',
    title: 'Statutory Legal Hierarchy Ordering for 7A, 7Q & 14B Certificates',
    changes: [
      'Implemented statutory legal hierarchy order: 7A -> 7Q (for 7A) -> 14B -> 7Q (for 14B).',
      'Enforced statutory hierarchy ordering across table sorting when clicking Est Code or Est Name.',
      'Ordered popup modal certificate cards strictly by legal hierarchy.'
    ]
  },
  {
    version: 'v2.5.0',
    date: '2026-07-26',
    title: 'Targeted Certificate Launcher & High-Precision Vector PDF Export Engine',
    changes: [
      'Added 1-click targeted certificate launcher opening ONLY 7A, 14B, or 7Q card in floating popup overlay.',
      'Integrated jsPDF + AutoTable engine for high-precision official EPFO Cuttack PDF exports.',
      'Added bright red Export PDF buttons to all 10 report modals with right-aligned monetary figures.'
    ]
  },
  {
    version: 'v2.4.0',
    date: '2026-07-26',
    title: 'Single-Page Application (SPA) Two-Page Tabbed Architecture & Multi-Column Sorting',
    changes: [
      'Created left sidebar navigation tabs: Dashboard Overview (Page 1) vs Establishment Search & Ledger (Page 2).',
      'Removed establishment ledgers from home page bottom to keep clean dashboard overview.',
      'Added interactive column header sorting (A-Z, 0-9) with dynamic sequential Sl. No. (#1, #2, #3...).'
    ]
  },
  {
    version: 'v2.3.0',
    date: '2026-07-26',
    title: '7 Operational Analytics Cards & Interactive Intelligence Modals',
    changes: [
      'Added 7 Analytics Cards: Top Defaulters, District Breakdown, RO Matrix, Ageing, Action Stage, Collection Mode, 5-Account Split.',
      'Added 7 interactive report modals with CSV exports and dynamic preview lists.'
    ]
  },
  {
    version: 'v2.2.0',
    date: '2026-07-26',
    title: 'Enforcement Officer (EO) Monthly Performance Cards & Historical Matrix',
    changes: [
      'Added Enforcement Officer monthly performance cards with total dues, monthly collections & pending balances.',
      'Built EO Historical Performance Modal with month selector and Filter RRCs shortcut.'
    ]
  },
  {
    version: 'v2.1.0',
    date: '2026-07-26',
    title: 'Tokenized Multi-Field & Digit Search Engine',
    changes: [
      'Upgraded Quick Search to tokenized multi-field matching across Est Name, Est Code, and RRC No.',
      'Added digit fallback search and master establishment code mapping.'
    ]
  },
  {
    version: 'v2.0.0',
    date: '2026-07-26',
    title: 'Supabase Cloud Synchronization & Multi-Account Receipt Tracking',
    changes: [
      'Migrated 2,810 RRC records to Supabase PostgreSQL database.',
      'Built 5-account live receipt recording engine (Accounts 1, 2, 10, 21, 22).'
    ]
  }
];

// ------------------------------------------------------------------
// Authentication Guard & Logout
// ------------------------------------------------------------------
async function checkAuthAndInit() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    // Not logged in — redirect to login page instantly
    window.location.replace('login.html');
    return;
  }

  // Session valid — unhide body safely
  if (document.body) {
    document.body.style.setProperty('display', 'block', 'important');
    document.body.style.setProperty('visibility', 'visible', 'important');
    document.body.style.setProperty('opacity', '1', 'important');
  }

  // Show user email badge + logout button
  const userEmail = session.user.email || '';
  const badge = document.getElementById('loggedInUserBadge');
  const emailSpan = document.getElementById('loggedInUserEmail');
  const logoutBtn = document.getElementById('logoutBtn');
  if (badge) badge.style.display = 'inline-flex';
  if (emailSpan) emailSpan.textContent = userEmail;
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';

  // Continue normal initialization
  setTodayDateInputs();
  const versionBadge = document.getElementById('appVersionBadge');
  if (versionBadge) {
    versionBadge.innerHTML = `<i class="fas fa-code-branch me-1"></i> Version ${APP_VERSION}`;
  }
  localStorage.removeItem('rrc_manager_web_state');
  await loadAllData();
  clearDashboardData();
}

async function handleLogout() {
  showSaveStatus('⏳ Signing out...', 'var(--warning)');
  await supabaseClient.auth.signOut();
  window.location.replace('login.html');
}


function setTodayDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  const popDate = document.getElementById('popPayDate');
  if (popDate) popDate.value = today;
}

async function loadAllData() {
  showSaveStatus('⏳ Loading master records from Supabase...', 'var(--warning)');
  try {
    // Fetch rrc_master (all rows using pagination)
    let allMaster = [];
    let from = 0;
    let step = 1000;
    while (true) {
      const { data, error } = await supabaseClient
        .from('rrc_master')
        .select('*')
        .range(from, from + step - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allMaster = allMaster.concat(data);
      if (data.length < step) break;
      from += step;
    }
    // Filter out Excel footer/total summary rows (rows missing est_code and rrc_no)
    appData.master = allMaster.filter(r => cleanStr(r.est_code) !== '' || cleanStr(r.rrc_no) !== '');

    // Fetch recovery_log
    const { data: logs, error: logErr } = await supabaseClient.from('recovery_log').select('*');
    if (logErr) throw logErr;
    appData.recoveryLog = logs || [];

    // Fetch fully_recovered_log
    const { data: frLogs, error: frErr } = await supabaseClient.from('fully_recovered_log').select('*');
    if (frErr) throw frErr;
    appData.fullyRecoveredLog = frLogs || [];

    updateGlobalMetrics();
    populateEoMonthOptions();
    renderEoPerformanceCards();
    renderSevenAnalyticsCards();
    updateSearchDropdown(appData.currentMode);
    clearDashboardData();
    showSaveStatus('✓ Synced with Supabase (' + appData.master.length + ' certificates loaded)', 'var(--success)');
  } catch (err) {
    console.error('Data Load Error:', err);
    showSaveStatus('⚠ Error loading data: ' + err.message, 'var(--danger)');
  }
}

// ------------------------------------------------------------------
// Enforcement Officer (EO) Monthly Collection Cards & Report
// ------------------------------------------------------------------
function populateEoMonthOptions() {
  const select = document.getElementById('eoMonthSelect');
  if (!select) return;

  const monthSet = new Set();
  appData.recoveryLog.forEach(l => {
    if (l.date) {
      const monthKey = String(l.date).slice(0, 7); // YYYY-MM
      monthSet.add(monthKey);
    }
  });

  const sortedMonths = Array.from(monthSet).sort().reverse();
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  if (!sortedMonths.includes(currentMonthKey)) {
    sortedMonths.unshift(currentMonthKey);
  }

  select.innerHTML = '';
  const allOp = document.createElement('option');
  allOp.value = 'ALL';
  allOp.textContent = 'All Time';
  select.appendChild(allOp);

  sortedMonths.forEach(mKey => {
    const d = new Date(mKey + '-01');
    const label = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
    const op = document.createElement('option');
    op.value = mKey;
    op.textContent = label;
    select.appendChild(op);
  });

  select.value = currentMonthKey;
}

function renderEoPerformanceCards() {
  const grid = document.getElementById('eoCardsGrid');
  if (!grid) return;

  const select = document.getElementById('eoMonthSelect');
  const selectedMonth = select ? select.value : 'ALL';

  // Group master records by enforcement_officer
  let eoMap = {};

  appData.master.forEach(r => {
    let eo = cleanStr(r.enforcement_officer) || 'UNASSIGNED';
    if (!eoMap[eo]) {
      eoMap[eo] = {
        name: eo,
        totalRrc: 0,
        totalOb: 0,
        collectedMonth: 0,
        totalPaid: 0,
        estCodes: new Set()
      };
    }
    eoMap[eo].totalRrc++;
    eoMap[eo].totalOb += parseFloat(r.recovery_ob) || 0;
    eoMap[eo].totalPaid += parseFloat(r.recovered_curr_year) || 0;
    const est = cleanStr(r.est_code);
    if (est) eoMap[eo].estCodes.add(est);
  });

  // Calculate monthly collection for each EO from recovery_log
  appData.recoveryLog.forEach(l => {
    if (!l.date) return;
    const lMonth = String(l.date).slice(0, 7);
    if (selectedMonth !== 'ALL' && lMonth !== selectedMonth) return;

    const est = cleanStr(l.est_code);
    const amt = parseFloat(l.amount_deposited) || 0;

    // Find which EO this receipt belongs to
    const masterMatch = appData.master.find(m => cleanStr(m.est_code) === est || cleanStr(m.rrc_no) === cleanStr(l.rrc_no));
    if (masterMatch) {
      let eo = cleanStr(masterMatch.enforcement_officer) || 'UNASSIGNED';
      if (eoMap[eo]) {
        eoMap[eo].collectedMonth += amt;
      }
    }
  });

  grid.innerHTML = '';
  const eoKeys = Object.keys(eoMap).sort();

  if (eoKeys.length === 0) {
    grid.innerHTML = '<div style="color: var(--text-secondary); font-size: 13px;">No Enforcement Officers found.</div>';
    return;
  }

  eoKeys.forEach(eo => {
    const data = eoMap[eo];
    const pending = data.totalOb - (selectedMonth === 'ALL' ? data.totalPaid : data.collectedMonth);
    const pct = data.totalOb > 0 ? Math.min(100, Math.round(((selectedMonth === 'ALL' ? data.totalPaid : data.collectedMonth) / data.totalOb) * 100)) : 0;

    // Get initials for avatar
    const parts = eo.replace(/SH\./g, '').trim().split(' ');
    const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'EO';

    const card = document.createElement('div');
    card.className = 'eo-card';
    card.innerHTML = `
      <div class="eo-card-header">
        <div class="eo-avatar">${initials}</div>
        <div>
          <h4 class="eo-name">${eo}</h4>
          <span style="font-size: 11px; color: var(--text-secondary);">${data.totalRrc} RRC Certificates Assigned</span>
        </div>
      </div>

      <div class="eo-meta-stat">
        <span style="color: var(--text-secondary);">Total Dues OB:</span>
        <strong>${fmtCur(data.totalOb)}</strong>
      </div>

      <div class="eo-meta-stat">
        <span style="color: var(--text-secondary);">Collected ${selectedMonth === 'ALL' ? 'Total' : 'this Month'}:</span>
        <strong style="color: var(--success);">${fmtCur(selectedMonth === 'ALL' ? data.totalPaid : data.collectedMonth)}</strong>
      </div>

      <div class="eo-meta-stat">
        <span style="color: var(--text-secondary);">Outstanding Balance:</span>
        <strong style="color: var(--danger);">${fmtCur(pending > 0 ? pending : 0)}</strong>
      </div>

      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${pct}%;"></div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 11px; font-weight: 700; color: var(--accent);">${pct}% Recovered</span>
        <button class="sidebar-btn btn-outline" style="width: auto; padding: 4px 10px; margin: 0; font-size: 11px;" onclick="filterByEo('${eo.replace(/'/g, "\\'")}')">
          <i class="fas fa-filter me-1"></i> Filter RRCs
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// -----------------------------------------------------------------------
// Shared Pagination Helper
// -----------------------------------------------------------------------
const RRC_PAGE_SIZE = 10;

function makePaginationBar(total, page, callbackFn) {
  const totalPages = Math.ceil(total / RRC_PAGE_SIZE);
  if (totalPages <= 1) return '';
  const start = (page - 1) * RRC_PAGE_SIZE + 1;
  const end = Math.min(page * RRC_PAGE_SIZE, total);
  return `
    <div class="rrc-pagination">
      <button onclick="${callbackFn}(1)" ${page === 1 ? 'disabled' : ''} title="First Page">
        <i class="fas fa-angles-left"></i> First
      </button>
      <button onclick="${callbackFn}(${page - 1})" ${page === 1 ? 'disabled' : ''} title="Previous Page">
        <i class="fas fa-angle-left"></i> Prev
      </button>
      <span class="rrc-page-info">Page <strong>${page}</strong> of <strong>${totalPages}</strong> &nbsp;&middot;&nbsp; ${start}–${end} of ${total} records</span>
      <button onclick="${callbackFn}(${page + 1})" ${page === totalPages ? 'disabled' : ''} title="Next Page">
        Next <i class="fas fa-angle-right"></i>
      </button>
      <button onclick="${callbackFn}(${totalPages})" ${page === totalPages ? 'disabled' : ''} title="Last Page">
        Last <i class="fas fa-angles-right"></i>
      </button>
    </div>
  `;
}

// -----------------------------------------------------------------------
// EO Filter RRC Modal — Paginated
// -----------------------------------------------------------------------
let _currentEoFilterName = '';
let _eoRrcRecords = [];
let _eoRrcSortKey = 'pending';
let _eoRrcSortAsc = false;

function _sortEoRrcDataset() {
  _eoRrcRecords.sort((a, b) => {
    let valA, valB;
    if (_eoRrcSortKey === 'pending') {
      valA = parseFloat(a.pending_curr_year) || parseFloat(a.recovery_ob) || 0;
      valB = parseFloat(b.pending_curr_year) || parseFloat(b.recovery_ob) || 0;
    } else if (_eoRrcSortKey === 'total_dues') {
      valA = parseFloat(a.recovery_ob) || 0;
      valB = parseFloat(b.recovery_ob) || 0;
    } else if (_eoRrcSortKey === 'est_name') {
      valA = cleanStr(a.est_name);
      valB = cleanStr(b.est_name);
    } else if (_eoRrcSortKey === 'est_code') {
      valA = cleanStr(a.est_code);
      valB = cleanStr(b.est_code);
    } else if (_eoRrcSortKey === 'type') {
      valA = cleanStr(a.type);
      valB = cleanStr(b.type);
    } else if (_eoRrcSortKey === 'rrc_no') {
      valA = cleanStr(a.rrc_no);
      valB = cleanStr(b.rrc_no);
    } else if (_eoRrcSortKey === 'period') {
      valA = cleanStr(a.period);
      valB = cleanStr(b.period);
    } else if (_eoRrcSortKey === 'district') {
      valA = cleanStr(a.district);
      valB = cleanStr(b.district);
    } else {
      valA = cleanStr(a.est_name);
      valB = cleanStr(b.est_name);
    }

    let comp = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comp = valA - valB;
    } else {
      comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
    }

    if (comp !== 0) {
      return _eoRrcSortAsc ? comp : -comp;
    }
    const nameComp = cleanStr(a.est_name).localeCompare(cleanStr(b.est_name));
    if (nameComp !== 0) return nameComp;
    return getCertificateLegalWeight(a.type) - getCertificateLegalWeight(b.type);
  });
}

function sortEoRrcBy(key) {
  if (_eoRrcSortKey === key) {
    _eoRrcSortAsc = !_eoRrcSortAsc;
  } else {
    _eoRrcSortKey = key;
    _eoRrcSortAsc = (key === 'pending' || key === 'total_dues') ? false : true;
  }
  _sortEoRrcDataset();
  renderEoRrcPage(1);
}

function filterByEo(eoName) {
  const matches = appData.master.filter(r => (cleanStr(r.enforcement_officer) || 'UNASSIGNED') === eoName);
  if (matches.length === 0) return alert('No certificates found for ' + eoName);

  _currentEoFilterName = eoName;
  _eoRrcRecords = [...matches];
  _eoRrcSortKey = 'pending';
  _eoRrcSortAsc = false;
  _sortEoRrcDataset();

  const titleEl = document.getElementById('eoRrcFilterTitle');
  const subEl = document.getElementById('eoRrcFilterSubtitle');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-user-shield me-2" style="color: var(--accent);"></i> ${eoName} — Pending RRC List`;
  if (subEl) subEl.textContent = `${_eoRrcRecords.length} Recovery Certificate${_eoRrcRecords.length !== 1 ? 's' : ''} assigned · sorted by pending amount`;

  renderEoRrcPage(1);
  openModal('eoRrcFilterModal');
}

function renderEoRrcPage(page) {
  const records = _eoRrcRecords;
  const total = records.length;
  const start = (page - 1) * RRC_PAGE_SIZE;
  const pageRecs = records.slice(start, start + RRC_PAGE_SIZE);

  let html = `<div class="table-responsive"><table class="ledger-table" id="eoRrcFilterTable" data-full-dataset-sort="true"><thead><tr>
    <th>Sl. No.</th>
    ${makeSortableTh('EST Code', 'est_code', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy')}
    ${makeSortableTh('Establishment Name', 'est_name', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy')}
    ${makeSortableTh('Type', 'type', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy')}
    ${makeSortableTh('RRC No', 'rrc_no', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy')}
    ${makeSortableTh('Period', 'period', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy')}
    ${makeSortableTh('District', 'district', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy')}
    ${makeSortableTh('Total Dues OB (₹)', 'total_dues', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy', 'text-end')}
    ${makeSortableTh('Pending Amount (₹)', 'pending', _eoRrcSortKey, _eoRrcSortAsc, 'sortEoRrcBy', 'text-end')}
    <th class="text-center">Action</th>
  </tr></thead><tbody>`;

  pageRecs.forEach((r, i) => {
    const ob = parseFloat(r.recovery_ob) || 0;
    const pend = parseFloat(r.pending_curr_year) || ob;
    const code = cleanStr(r.est_code);
    const typeStr = cleanStr(r.type);
    const rrcNo = cleanStr(r.rrc_no);
    const globalIdx = start + i;
    html += `
      <tr style="cursor:pointer;" onclick="closeModal('eoRrcFilterModal'); quickOpenEstablishment('${code}', ${r.id}, '${typeStr}')" title="Click to open ${typeStr} (${rrcNo}) ledger">
        <td><strong>#${globalIdx + 1}</strong></td>
        <td><code style="color:var(--accent);font-weight:700;">${code}</code></td>
        <td class="est-name-cell"><strong style="color:var(--text-primary);">${cleanStr(r.est_name)}</strong> <i class="fas fa-external-link-alt ms-1" style="font-size:10px;color:var(--accent);opacity:0.8;"></i></td>
        <td><span class="type-badge" onclick="event.stopPropagation(); closeModal('eoRrcFilterModal'); quickOpenEstablishment('${code}',${r.id},'${typeStr}')" style="cursor:pointer;">${typeStr}</span></td>
        <td>${rrcNo}</td>
        <td style="font-size:11px;color:var(--text-secondary);">${cleanStr(r.period) || '-'}</td>
        <td>${cleanStr(r.district) || 'N/A'}</td>
        <td class="text-end">${fmtCur(ob)}</td>
        <td class="text-end val-pending">${fmtCur(pend)}</td>
        <td class="text-center">
          <button class="sidebar-btn btn-success" style="width:auto;margin:0;padding:4px 10px;font-size:10px;border-radius:6px;" onclick="event.stopPropagation(); closeModal('eoRrcFilterModal'); quickOpenEstablishment('${code}',${r.id},'${typeStr}')">
            <i class="fas fa-plus-circle me-1"></i> Open ${typeStr}
          </button>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById('eoRrcFilterModalBody').innerHTML = html;
  document.getElementById('eoRrcFilterPagination').innerHTML = makePaginationBar(total, page, 'renderEoRrcPage');
}

function exportEoRrcFilterCsv() {
  const labelMap = { pending: 'Pending Amount', total_dues: 'Total Dues OB', est_name: 'Establishment Name', est_code: 'EST Code', type: 'Type', rrc_no: 'RRC No', period: 'Period', district: 'District' };
  const sortLabel = labelMap[_eoRrcSortKey] || _eoRrcSortKey;
  let csv = `Enforcement Officer: ${_currentEoFilterName} — Sorted by ${sortLabel} (${_eoRrcSortAsc ? 'Ascending' : 'Descending'})\nRank,EST Code,EST Name,Type,RRC No,Period,District,Total Dues OB,Pending Amount\n`;
  _eoRrcRecords.forEach((r, idx) => {
    csv += `${idx + 1},"${cleanStr(r.est_code)}","${cleanStr(r.est_name)}","${cleanStr(r.type)}","${cleanStr(r.rrc_no)}","${cleanStr(r.period) || ''}","${cleanStr(r.district)}",${r.recovery_ob || 0},${r.pending_curr_year || 0}\n`;
  });
  const safeEo = _currentEoFilterName.replace(/[^a-zA-Z0-9_]/g, '_');
  downloadCsvFile(csv, `EO_RRC_Filter_${safeEo}.csv`);
}

function exportEoRrcFilterPdf() {
  const labelMap = { pending: 'Pending Amount', total_dues: 'Total Dues OB', recovered: 'Total Payment Received', est_name: 'Establishment Name', est_code: 'EST Code', type: 'Type', rrc_no: 'RRC No', period: 'Period', district: 'District' };
  const sortLabel = labelMap[_eoRrcSortKey] || _eoRrcSortKey;
  const headers = ['Sl.No', 'EST Code', 'Establishment Name', 'Type', 'RRC No', 'Period', 'District', 'Total Dues OB (Rs.)', 'Total Payment Received (Rs.)', 'Pending Amount (Rs.)'];
  const rows = _eoRrcRecords.map((r, i) => [
    i + 1, cleanStr(r.est_code), cleanStr(r.est_name), cleanStr(r.type),
    cleanStr(r.rrc_no), cleanStr(r.period) || '-', cleanStr(r.district) || 'N/A',
    fmtCur(parseFloat(r.recovery_ob) || 0).replace(/₹/g, 'Rs.'),
    fmtCur(parseFloat(r.recovered_curr_year) || 0).replace(/₹/g, 'Rs.'),
    fmtCur(parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0).replace(/₹/g, 'Rs.')
  ]);
  generateDataPdf(
    `Pending RRC List — ${_currentEoFilterName}`,
    `${rows.length} Recovery Certificates assigned to ${_currentEoFilterName} · Sorted by ${sortLabel} (${_eoRrcSortAsc ? 'Ascending' : 'Descending'})`,
    headers, rows
  );
}



// ------------------------------------------------------------------
// EO Performance History Modal & CSV Export
// ------------------------------------------------------------------
function showEoReportModal() {
  const container = document.getElementById('eoReportBody');
  container.innerHTML = '';

  // Get all unique months from recovery_log
  let monthSet = new Set();
  appData.recoveryLog.forEach(l => {
    if (l.date) monthSet.add(String(l.date).slice(0, 7));
  });

  const months = Array.from(monthSet).sort().reverse();

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Enforcement Officer (EO)</th>
            <th class="text-center">Assigned RRCs</th>
            <th class="text-end">Total Dues OB (₹)</th>
            <th class="text-end">Amount Collected (₹)</th>
            <th class="text-end">Outstanding Balance (₹)</th>
            <th class="text-center">Recovery Rate</th>
          </tr>
        </thead>
        <tbody>
  `;

  let grandOb = 0;
  let grandCollected = 0;

  // Build EO mapping
  let allEos = Array.from(new Set(appData.master.map(r => cleanStr(r.enforcement_officer) || 'UNASSIGNED'))).sort();

  months.forEach(mKey => {
    const monthLabel = new Date(mKey + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' });
    let monthOb = 0;
    let monthCollected = 0;

    allEos.forEach(eo => {
      const eoMaster = appData.master.filter(r => (cleanStr(r.enforcement_officer) || 'UNASSIGNED') === eo);
      const totalRrc = eoMaster.length;
      const totalOb = eoMaster.reduce((s, r) => s + (parseFloat(r.recovery_ob) || 0), 0);

      // Monthly collected by this EO
      const collected = appData.recoveryLog
        .filter(l => l.date && String(l.date).slice(0, 7) === mKey)
        .filter(l => {
          const mMatch = appData.master.find(m => cleanStr(m.est_code) === cleanStr(l.est_code) || cleanStr(m.rrc_no) === cleanStr(l.rrc_no));
          return mMatch && (cleanStr(mMatch.enforcement_officer) || 'UNASSIGNED') === eo;
        })
        .reduce((s, l) => s + (parseFloat(l.amount_deposited) || 0), 0);

      if (collected > 0 || totalOb > 0) {
        monthOb += totalOb;
        monthCollected += collected;
        grandOb += totalOb;
        grandCollected += collected;

        const pending = totalOb - collected;
        const pct = totalOb > 0 ? Math.min(100, Math.round((collected / totalOb) * 100)) : 0;

        html += `
          <tr>
            <td><strong>${monthLabel}</strong></td>
            <td><strong>${eo}</strong></td>
            <td class="text-center">${totalRrc}</td>
            <td class="text-end">${fmtCur(totalOb)}</td>
            <td class="text-end val-cleared">${fmtCur(collected)}</td>
            <td class="text-end ${pending > 0 ? 'val-pending' : 'val-cleared'}">${fmtCur(pending > 0 ? pending : 0)}</td>
            <td class="text-center"><span class="type-badge">${pct}%</span></td>
          </tr>
        `;
      }
    });

    html += `
      <tr style="background: var(--bg-card-alt); font-weight: 700;">
        <td colspan="4">${monthLabel} Subtotal</td>
        <td class="text-end val-cleared">${fmtCur(monthCollected)}</td>
        <td class="text-end val-pending">${fmtCur(monthOb - monthCollected > 0 ? monthOb - monthCollected : 0)}</td>
        <td></td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row" style="font-size: 14px;">
          <td colspan="4">GRAND TOTAL ACROSS ALL MONTHS</td>
          <td class="text-end val-cleared">${fmtCur(grandCollected)}</td>
          <td class="text-end val-pending">${fmtCur(grandOb - grandCollected > 0 ? grandOb - grandCollected : 0)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
  `;

  container.innerHTML = html;
  openModal('eoReportModal');
}

function exportEoReportCsv() {
  let csv = 'Month,Enforcement Officer,Assigned RRCs,Total Dues OB,Amount Collected,Outstanding Balance,Recovery Rate\n';
  let monthSet = new Set();
  appData.recoveryLog.forEach(l => {
    if (l.date) monthSet.add(String(l.date).slice(0, 7));
  });
  const months = Array.from(monthSet).sort().reverse();
  let allEos = Array.from(new Set(appData.master.map(r => cleanStr(r.enforcement_officer) || 'UNASSIGNED'))).sort();

  months.forEach(mKey => {
    const monthLabel = new Date(mKey + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' });
    allEos.forEach(eo => {
      const eoMaster = appData.master.filter(r => (cleanStr(r.enforcement_officer) || 'UNASSIGNED') === eo);
      const totalRrc = eoMaster.length;
      const totalOb = eoMaster.reduce((s, r) => s + (parseFloat(r.recovery_ob) || 0), 0);
      const collected = appData.recoveryLog
        .filter(l => l.date && String(l.date).slice(0, 7) === mKey)
        .filter(l => {
          const mMatch = appData.master.find(m => cleanStr(m.est_code) === cleanStr(l.est_code) || cleanStr(m.rrc_no) === cleanStr(l.rrc_no));
          return mMatch && (cleanStr(mMatch.enforcement_officer) || 'UNASSIGNED') === eo;
        })
        .reduce((s, l) => s + (parseFloat(l.amount_deposited) || 0), 0);

      if (collected > 0 || totalOb > 0) {
        const pending = totalOb - collected;
        const pct = totalOb > 0 ? Math.min(100, Math.round((collected / totalOb) * 100)) : 0;
        csv += `"${monthLabel}","${eo}",${totalRrc},${totalOb},${collected},${pending > 0 ? pending : 0},"${pct}%"\n`;
      }
    });
  });

  downloadCsvFile(csv, 'EO_Monthly_Recovery_Report.csv');
}

function updateGlobalMetrics() {
  const totalRrc = appData.master.length;
  let totalDues = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let frCount = 0;

  appData.master.forEach(r => {
    totalDues += parseFloat(r.recovery_ob) || 0;
    totalPaid += parseFloat(r.recovered_curr_year) || 0;
    totalPending += parseFloat(r.pending_curr_year) || 0;
    if (cleanStr(r.fully_recovered) === 'Yes' || (parseFloat(r.pending_curr_year) || 0) <= 0) {
      frCount++;
    }
  });

  document.getElementById('metricTotalRrc').textContent = totalRrc.toLocaleString();
  document.getElementById('metricTotalDues').textContent = fmtCur(totalDues);
  document.getElementById('metricTotalRecovered').textContent = fmtCur(totalPaid);
  document.getElementById('metricTotalPending').textContent = fmtCur(totalPending);
  document.getElementById('metricFullyRecoveredCount').textContent = frCount.toLocaleString();
}

function showSaveStatus(msg, color) {
  const el = document.getElementById('saveStatusLbl');
  if (el) {
    el.textContent = msg;
    el.style.color = color || 'var(--text-secondary)';
  }
}

// ------------------------------------------------------------------
// Search & Filter Logic
// ------------------------------------------------------------------
function setSearchMode(mode) {
  appData.currentMode = mode;
  document.querySelectorAll('.search-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  updateSearchDropdown(mode);
}

function updateSearchDropdown(mode) {
  let list = [];
  const colMap = { 'RRC No': 'rrc_no', 'Est Code': 'est_code', 'Est Name': 'est_name' };
  const targetCol = colMap[mode] || 'est_code';

  const set = new Set();
  appData.master.forEach(r => {
    const val = cleanStr(r[targetCol]);
    if (val) set.add(val);
  });
  list = Array.from(set).sort();

  appData.currentOptions = list;
  filterOptions();
}

function filterOptions() {
  const inputEl = document.getElementById('filterEntry');
  const rawQuery = inputEl ? inputEl.value.trim().toLowerCase() : '';
  const dropdown = document.getElementById('searchDropdown');
  if (!dropdown) return;
  dropdown.innerHTML = '';

  if (!rawQuery) {
    // Default mode-based list when quick search is empty
    let filtered = appData.currentOptions;
    if (filtered.length === 0) {
      dropdown.innerHTML = '<option value="">No matches found</option>';
      clearDashboardData();
      return;
    }

    const defaultOp = document.createElement('option');
    defaultOp.value = '';
    defaultOp.textContent = `-- Select ${appData.currentMode} --`;
    dropdown.appendChild(defaultOp);

    filtered.slice(0, 200).forEach(opt => {
      const op = document.createElement('option');
      op.value = opt;
      op.textContent = opt;
      dropdown.appendChild(op);
    });

    dropdown.value = '';
    clearDashboardData();
    return;
  }

  // Tokenize search query (e.g., "kanchan 1683" -> ["kanchan", "1683"])
  const tokens = rawQuery.split(/[\s,/-]+/).filter(t => t.length > 0);
  const matchesMap = new Map();

  appData.master.forEach(r => {
    const code = cleanStr(r.est_code);
    const name = cleanStr(r.est_name);
    const rrc = cleanStr(r.rrc_no);
    const combinedStr = `${code} ${name} ${rrc}`.toLowerCase();
    const combinedDigits = combinedStr.replace(/\D/g, '');

    // Every token must match somewhere in text or numeric digits
    const isMatch = tokens.every(t => {
      const isNum = /^\d+$/.test(t);
      if (isNum) {
        return combinedStr.includes(t) || combinedDigits.includes(t);
      } else {
        return combinedStr.includes(t);
      }
    });

    if (isMatch) {
      const key = code || rrc || name;
      if (!matchesMap.has(key)) {
        let label = code ? `${code} — ${name}` : (name || rrc);
        if (rrc) label += ` (RRC: ${rrc})`;
        matchesMap.set(key, { key: key, label: label });
      }
    }
  });

  const matchedItems = Array.from(matchesMap.values());

  if (matchedItems.length === 0) {
    // Smart Fallback Search: Extract significant sub-numbers (e.g. "1683" from "ORBBS0001683000")
    const sigNumbers = rawQuery.match(/\d{3,}/g);
    if (sigNumbers && sigNumbers.length > 0) {
      const fallbackMap = new Map();
      appData.master.forEach(r => {
        const code = cleanStr(r.est_code);
        const name = cleanStr(r.est_name);
        const rrc = cleanStr(r.rrc_no);
        const combined = `${code} ${name} ${rrc}`.toLowerCase();

        sigNumbers.forEach(numStr => {
          // Remove leading zeros to get core digits (e.g., "0001683000" -> "1683")
          const cleanNum = numStr.replace(/^0+/, '');
          const subNum = cleanNum.length >= 4 ? cleanNum.slice(0, 4) : cleanNum;
          
          if (combined.includes(numStr) || (cleanNum && combined.includes(cleanNum)) || (subNum && combined.includes(subNum))) {
            const key = code || rrc || name;
            if (!fallbackMap.has(key)) {
              let label = code ? `${code} — ${name}` : (name || rrc);
              if (rrc) label += ` (RRC: ${rrc})`;
              fallbackMap.set(key, { key: key, label: label });
            }
          }
        });
      });

      const fallbackItems = Array.from(fallbackMap.values());
      if (fallbackItems.length > 0) {
        const defaultOp = document.createElement('option');
        defaultOp.value = '';
        defaultOp.textContent = `-- Closest Matches for "${sigNumbers[0].replace(/^0+/, '') || sigNumbers[0]}" (${fallbackItems.length} found) --`;
        dropdown.appendChild(defaultOp);

        fallbackItems.slice(0, 250).forEach(item => {
          const op = document.createElement('option');
          op.value = item.key;
          op.textContent = item.label;
          dropdown.appendChild(op);
        });

        dropdown.value = '';
        clearDashboardData();
        return;
      }
    }

    dropdown.innerHTML = `<option value="">No matches found for "${rawQuery}"</option>`;
    clearDashboardData();
    return;
  }

  const defaultOp = document.createElement('option');
  defaultOp.value = '';
  defaultOp.textContent = `-- Select Matching Result (${matchedItems.length} found) --`;
  dropdown.appendChild(defaultOp);

  matchedItems.slice(0, 250).forEach(item => {
    const op = document.createElement('option');
    op.value = item.key;
    op.textContent = item.label;
    dropdown.appendChild(op);
  });

  dropdown.value = '';
  clearDashboardData();
}

// ------------------------------------------------------------------
// Page Navigation Tabs (Dashboard Overview vs Establishment Search)
// ------------------------------------------------------------------
function switchMainTab(tab) {
  const dashView = document.getElementById('pageDashboardView');
  const estView = document.getElementById('pageEstView');
  const dashBtn = document.getElementById('navDashboardBtn');
  const estBtn = document.getElementById('navEstBtn');
  const titleEl = document.getElementById('topNavTitle');
  const subtitleEl = document.getElementById('topNavSubtitle');

  if (tab === 'establishment') {
    if (dashView) dashView.style.display = 'none';
    if (estView) estView.style.display = 'block';
    if (dashBtn) dashBtn.classList.remove('active');
    if (estBtn) estBtn.classList.add('active');
    if (titleEl) titleEl.textContent = 'Establishment Ledger Inspector';
    if (subtitleEl) subtitleEl.textContent = 'Individual Establishment 14B / 7A / 7Q Dues & Date-Wise Receipts Ledger';
  } else {
    if (dashView) dashView.style.display = 'block';
    if (estView) estView.style.display = 'none';
    if (dashBtn) dashBtn.classList.add('active');
    if (estBtn) estBtn.classList.remove('active');
    if (titleEl) titleEl.textContent = 'RRC Master Ledger Dashboard';
    if (subtitleEl) subtitleEl.textContent = 'Real-time Recovery Certificate Tracking & Account Breakdown System';
  }
}

function resetUI() {
  document.getElementById('filterEntry').value = '';
  updateSearchDropdown(appData.currentMode);
  switchMainTab('dashboard');
  saveState();
}

function clearDashboardData() {
  document.getElementById('titleLbl').textContent = 'Select an establishment to populate metrics';
  document.getElementById('subtitleLbl').textContent = 'Establishment specific details will appear below';
  document.getElementById('recoveryLbl').innerHTML = '<i class="fas fa-user-shield me-1"></i> Recovery Officer: Not Selected &nbsp;•&nbsp; Enforcement Officer: Not Selected';
  document.getElementById('saveStatusLbl').textContent = '';
  document.getElementById('matchedRecordsBox').innerHTML = '<option value="">Select Establishment first</option>';
  document.getElementById('tablesContainer').innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <i class="fas fa-magnifying-glass fa-2x mb-3" style="color: var(--accent);"></i>
      <p>Please select an establishment code or RRC number from the sidebar to view certificate ledgers.</p>
    </div>
  `;
  appData.matchedGroups = [];
}

// ------------------------------------------------------------------
// Certificate Grouping Engine (7A + 7Q / 14B + 7Q)
// ------------------------------------------------------------------
function buildRrcGroups(subset) {
  let used = new Set();
  let groups7a = [];
  let groups14b = [];
  let groupsOther = [];

  function findLinked7Q(parentItem) {
    const period = cleanStr(parentItem.period);
    if (!period) return null;
    return subset.find(item => !used.has(item.id) && cleanStr(item.type) === '7Q' && cleanStr(item.period) === period);
  }

  subset.forEach(item => {
    if (used.has(item.id)) return;
    const t = cleanStr(item.type);
    if (t === '7A') {
      used.add(item.id);
      let group = [item];
      let linked = findLinked7Q(item);
      if (linked) {
        used.add(linked.id);
        group.push(linked);
      }
      groups7a.push(group);
    } else if (t === '14B') {
      used.add(item.id);
      let group = [item];
      let linked = findLinked7Q(item);
      if (linked) {
        used.add(linked.id);
        group.push(linked);
      }
      groups14b.push(group);
    }
  });

  subset.forEach(item => {
    if (used.has(item.id)) return;
    used.add(item.id);
    if (groups7a.length > 0) groups7a.append ? groups7a.push([item]) : groups7a.push([item]);
    else if (groups14b.length > 0) groups14b.push([item]);
    else groupsOther.push([item]);
  });

  return [...groups7a, ...groups14b, ...groupsOther];
}

function onRecordSelect(selection) {
  if (!selection || selection === '' || selection === 'No matches found') {
    clearDashboardData();
    return;
  }

  // Flexible match across EST CODE, RRC NO, and EST NAME
  let matched = appData.master.filter(r => cleanStr(r.est_code) === selection);
  if (matched.length === 0) {
    matched = appData.master.filter(r => cleanStr(r.rrc_no) === selection);
  }
  if (matched.length === 0) {
    matched = appData.master.filter(r => cleanStr(r.est_name) === selection);
  }

  if (matched.length === 0) {
    clearDashboardData();
    return;
  }

  // Switch to Establishment Page View
  switchMainTab('establishment');

  appData.matchedGroups = buildRrcGroups(matched);

  const selectBox = document.getElementById('matchedRecordsBox');
  selectBox.innerHTML = '';

  let recordLabels = [];
  appData.matchedGroups.forEach((rows, idx) => {
    const types = rows.map(r => cleanStr(r.type) || 'N/A').join(' + ');
    const rrcNos = Array.from(new Set(rows.map(r => cleanStr(r.rrc_no) || 'N/A'))).join(', ');
    let label = `${types}  |  RRC: ${rrcNos}`;
    const p = cleanStr(rows[0].period);
    if (p) label += `  |  Period: ${p}`;

    recordLabels.push(label);
    const op = document.createElement('option');
    op.value = idx;
    op.textContent = label;
    selectBox.appendChild(op);
  });

  selectBox.value = 0;
  displaySpecificRow(0);
  saveState();
}

// ------------------------------------------------------------------
// Detail Rendering
// ------------------------------------------------------------------
function displaySpecificRow(groupIndexStr) {
  const index = parseInt(groupIndexStr, 10) || 0;
  if (!appData.matchedGroups || !appData.matchedGroups[index]) return;

  const rows = appData.matchedGroups[index];
  const primary = rows[0];

  document.getElementById('titleLbl').textContent = cleanStr(primary.est_name) || 'Unknown Establishment';
  document.getElementById('subtitleLbl').textContent =
    `Code: ${cleanStr(primary.est_code)}   •   RRC No: ${cleanStr(primary.rrc_no)}   •   Showing: ${rows.map(r => cleanStr(r.type)).join(' + ')}`;

  const recOfficer = cleanStr(primary.recovery_officer) || 'N/A';
  const enfOfficer = cleanStr(primary.enforcement_officer) || 'N/A';
  document.getElementById('recoveryLbl').innerHTML =
    `<i class="fas fa-user-shield me-1"></i> Recovery Officer: <strong>${recOfficer}</strong> &nbsp;•&nbsp; Enforcement Officer: <strong>${enfOfficer}</strong>`;

  const container = document.getElementById('tablesContainer');
  container.innerHTML = '';

  rows.forEach(row => {
    const cardEl = buildCertificateCard(row);
    container.appendChild(cardEl);
  });

  saveState();
}

function buildCertificateCard(row) {
  const card = document.createElement('div');
  card.className = 'certificate-card';
  card.id = `cert-card-${row.id}`;

  const isFullyRecovered = cleanStr(row.fully_recovered) === 'Yes' || (parseFloat(row.pending_curr_year) || 0) <= 0;

  let headerHtml = `
    <div class="card-header-bar">
      <div style="display: flex; align-items: center; gap: 12px;">
        <span class="type-badge">${cleanStr(row.type) || 'N/A'}</span>
        <span style="font-weight: 700; font-size: 14px;">RRC No: ${cleanStr(row.rrc_no)} &nbsp;•&nbsp; Period: ${cleanStr(row.period)}</span>
        ${isFullyRecovered ? '<span class="recovered-badge"><i class="fas fa-check-circle me-1"></i> Fully Recovered</span>' : ''}
      </div>
      <span style="font-size: 11px; color: var(--text-secondary);">Deposited column is editable — press Enter to save to Supabase</span>
    </div>
  `;

  const accounts = ['1', '2', '10', '21', '22'];
  let dueVals = {};
  let rowsHtml = '';
  let totalOb = 0, totalPaid = 0, totalPending = 0;

  accounts.forEach(ac => {
    const ob = parseFloat(row[`acc_${ac}_ob`]) || 0;
    const paid = parseFloat(row[`acc_${ac}_paid`]) || 0;
    const pending = parseFloat(row[`acc_${ac}_pending`]) || 0;
    dueVals[ac] = ob;

    totalOb += ob;
    totalPaid += paid;
    totalPending += pending;

    const pendClass = pending > 0 ? 'val-pending' : 'val-cleared';

    rowsHtml += `
      <tr>
        <td><strong>Account ${ac}</strong></td>
        <td class="text-end">${fmtCur(ob)}</td>
        <td class="text-end" style="width: 160px;">
          <input type="text" class="editable-deposit-input" id="paid-in-${row.id}-${ac}" value="${paid.toFixed(2)}"
            onfocus="clearZeroOnClick(this)"
            onchange="onPaidEdited(${row.id}, '${ac}')"
            onkeydown="if(event.key==='Enter') this.blur()">
        </td>
        <td class="text-end ${pendClass}" id="bal-lbl-${row.id}-${ac}">${fmtCur(pending)}</td>
        <td class="text-center" style="width: 110px;">
          <button class="sidebar-btn btn-outline" style="width: auto; padding: 4px 10px; margin: 0; font-size: 11px;" onclick="showAccountHistory(${row.id}, '${ac}')">
            <i class="fas fa-history"></i> History
          </button>
        </td>
      </tr>
    `;
  });

  const grandPendClass = totalPending > 0 ? 'val-pending' : 'val-cleared';

  let tableHtml = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Account Type</th>
            <th class="text-end">Dues Amount (OB)</th>
            <th class="text-end">Deposited (Paid)</th>
            <th class="text-end">Outstanding Balance</th>
            <th class="text-center">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr class="total-row">
            <td>TOTAL</td>
            <td class="text-end" id="tot-ob-${row.id}">${fmtCur(totalOb)}</td>
            <td class="text-end" id="tot-paid-${row.id}">${fmtCur(totalPaid)}</td>
            <td class="text-end ${grandPendClass}" id="tot-bal-${row.id}">${fmtCur(totalPending)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  // Inner Date-Wise Receipt Ledger Card
  const receiptLedgerHtml = buildReceiptLedgerSection(row);

  // IR / NIR Case Status Panel
  const caseStatusHtml = buildCaseStatusPanel(row);

  card.innerHTML = headerHtml + caseStatusHtml + tableHtml + receiptLedgerHtml;
  return card;
}

// ------------------------------------------------------------------
// IR / NIR + Action Taken — Case Status Panel (Auto-Save)
// ------------------------------------------------------------------
const ACTION_TAKEN_OPTIONS = [
  'Notice / Under Recovery Process',
  'CP-1 Issued',
  'Before CP-1 Issued the Estt Deposited fully amount',
  'CP-1 & CP-5 Issued',
  'Fully Recovered'
];

function buildCaseStatusPanel(row) {
  const caseType    = cleanStr(row.case_type) || 'IR';
  const forum       = cleanStr(row.court_forum);
  const caseNo      = cleanStr(row.case_no);
  const caseDate    = cleanStr(row.case_date) ? String(row.case_date).slice(0, 10) : '';
  const actionTaken = cleanStr(row.action_taken);

  const isNir = caseType === 'NIR';

  const forumOptions = [
    'HIGH COURT', 'SUPREME COURT', 'CGIT',
    'DISTRICT COURT', 'LABOUR COURT', 'DRT', 'OTHERS'
  ].map(f => `<option value="${f}" ${forum === f ? 'selected' : ''}>${f}</option>`).join('');

  const actionOptions = ACTION_TAKEN_OPTIONS
    .map(a => `<option value="${a}" ${actionTaken === a ? 'selected' : ''}>${a}</option>`)
    .join('');

  const nirFields = `
    <div id="nir-fields-${row.id}" style="display:${isNir ? 'contents' : 'none'};">
      <div>
        <label class="form-label-sm"><i class="fas fa-landmark me-1"></i> Court / Forum</label>
        <select id="case-forum-${row.id}" class="custom-select" style="padding: 8px 10px; font-size: 12px;"
          onchange="saveCaseDetails(${row.id})">
          <option value="">-- Select Forum --</option>
          ${forumOptions}
        </select>
      </div>
      <div>
        <label class="form-label-sm"><i class="fas fa-hashtag me-1"></i> Case No</label>
        <input type="text" id="case-no-${row.id}" class="custom-input"
          placeholder="e.g. WP-1234/2024" value="${caseNo}"
          onblur="saveCaseDetails(${row.id})"
          onkeydown="if(event.key==='Enter') this.blur()">
      </div>
      <div>
        <label class="form-label-sm"><i class="fas fa-calendar-alt me-1"></i> Case Filing Date</label>
        <input type="date" id="case-date-${row.id}" class="custom-input" value="${caseDate}"
          onchange="saveCaseDetails(${row.id})">
      </div>
    </div>
  `;

  return `
    <div class="case-status-panel" id="case-panel-${row.id}">
      <div class="case-panel-header">
        <span style="font-size:12px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.08em;">
          <i class="fas fa-clipboard-list me-1"></i> Case Status &amp; Action Taken
        </span>
        <span class="panel-save-msg" id="panel-save-msg-${row.id}"></span>
      </div>
      <div class="case-status-grid">

        <!-- Case Type: IR / NIR -->
        <div>
          <label class="form-label-sm"><i class="fas fa-gavel me-1"></i> Case Type</label>
          <div class="ir-nir-toggle">
            <button id="btn-ir-${row.id}"
              class="ir-nir-btn ${!isNir ? 'active-ir' : ''}"
              onclick="onCaseTypeChange(${row.id}, 'IR')">
              <i class="fas fa-check-circle me-1"></i> IR
            </button>
            <button id="btn-nir-${row.id}"
              class="ir-nir-btn ${isNir ? 'active-nir' : ''}"
              onclick="onCaseTypeChange(${row.id}, 'NIR')">
              <i class="fas fa-balance-scale me-1"></i> NIR
            </button>
          </div>
        </div>

        <!-- NIR sub-fields (hidden for IR) -->
        ${nirFields}

        <!-- Action Taken (always visible) -->
        <div style="min-width: 260px;">
          <label class="form-label-sm"><i class="fas fa-tasks me-1"></i> Action Taken</label>
          <select id="action-taken-${row.id}" class="custom-select"
            style="padding: 8px 10px; font-size: 12px;"
            onchange="saveActionTaken(${row.id})">
            <option value="">-- Select Action --</option>
            ${actionOptions}
          </select>
        </div>

      </div>
      ${isNir && forum ? `<div class="nir-info-badge"><i class="fas fa-info-circle me-1"></i> Case filed in <strong>${forum}</strong>${caseNo ? ' &nbsp;|&nbsp; Case No: <strong>' + caseNo + '</strong>' : ''}${caseDate ? ' &nbsp;|&nbsp; Filed: <strong>' + caseDate + '</strong>' : ''}</div>` : ''}
    </div>
  `;
}

function showPanelSaveMsg(rowId, success, msg) {
  const el = document.getElementById(`panel-save-msg-${rowId}`);
  if (!el) return;
  el.textContent = msg;
  el.className = 'panel-save-msg ' + (success ? 'panel-save-ok' : 'panel-save-err');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.textContent = ''; el.className = 'panel-save-msg'; }, 4000);
}

function onCaseTypeChange(rowId, newType) {
  const btnIr  = document.getElementById(`btn-ir-${rowId}`);
  const btnNir = document.getElementById(`btn-nir-${rowId}`);
  const nirDiv = document.getElementById(`nir-fields-${rowId}`);

  if (newType === 'IR') {
    btnIr.className  = 'ir-nir-btn active-ir';
    btnNir.className = 'ir-nir-btn';
    nirDiv.style.display = 'none';
  } else {
    btnIr.className  = 'ir-nir-btn';
    btnNir.className = 'ir-nir-btn active-nir';
    nirDiv.style.display = 'contents';
  }
  saveCaseDetails(rowId);
}

async function saveCaseDetails(rowId) {
  const btnIr = document.getElementById(`btn-ir-${rowId}`);
  const isIr  = btnIr && btnIr.classList.contains('active-ir');
  const caseType = isIr ? 'IR' : 'NIR';

  const forum    = isIr ? null : (document.getElementById(`case-forum-${rowId}`)?.value || null);
  const caseNo   = isIr ? null : (document.getElementById(`case-no-${rowId}`)?.value.trim() || null);
  const caseDate = isIr ? null : (document.getElementById(`case-date-${rowId}`)?.value || null);

  const { error } = await supabaseClient
    .from('rrc_master')
    .update({ case_type: caseType, court_forum: forum, case_no: caseNo, case_date: caseDate || null })
    .eq('id', rowId);

  if (error) {
    showPanelSaveMsg(rowId, false, '⚠ Save failed: ' + error.message);
    return;
  }

  const row = appData.master.find(r => r.id === rowId);
  if (row) {
    row.case_type   = caseType;
    row.court_forum = forum;
    row.case_no     = caseNo;
    row.case_date   = caseDate;
  }
  showPanelSaveMsg(rowId, true, '✓ Data Saved Successfully');
}

async function saveActionTaken(rowId) {
  const val = document.getElementById(`action-taken-${rowId}`)?.value || '';

  const { error } = await supabaseClient
    .from('rrc_master')
    .update({ action_taken: val })
    .eq('id', rowId);

  if (error) {
    showPanelSaveMsg(rowId, false, '⚠ Save failed: ' + error.message);
    return;
  }

  const row = appData.master.find(r => r.id === rowId);
  if (row) row.action_taken = val;

  showPanelSaveMsg(rowId, true, '✓ Data Saved Successfully');
}


// ------------------------------------------------------------------
// Date-Wise Receipt Ledger Section (per Certificate Card)

// ------------------------------------------------------------------
function buildReceiptLedgerSection(row) {
  const accounts = ['1', '2', '10', '21', '22'];
  const estCode = cleanStr(row.est_code);
  const rrcNo = cleanStr(row.rrc_no);
  const type = cleanStr(row.type);

  // Filter recovery log for this certificate
  const logs = appData.recoveryLog.filter(l => cleanStr(l.est_code) === estCode && cleanStr(l.type) === type);

  // Group by Txn_ID or Receipt No / Date
  let grouped = {};
  logs.forEach(l => {
    const dt = l.date ? String(l.date).slice(0, 10) : '';
    const rcpt = cleanStr(l.receipt_no);
    const key = l.txn_id || `${dt}___${rcpt}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l);
  });

  // Sort groups by Date descending (latest on top)
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const dtA = grouped[a][0].date ? new Date(grouped[a][0].date).getTime() : 0;
    const dtB = grouped[b][0].date ? new Date(grouped[b][0].date).getTime() : 0;
    if (dtA !== dtB) return dtB - dtA; // Newest date first
    const idA = grouped[a][0].id || 0;
    const idB = grouped[b][0].id || 0;
    return idB - idA; // Newest id first
  });

  let receiptRowsHtml = '';
  let rowIdx = 1;

  sortedKeys.forEach(gKey => {
    const group = grouped[gKey];
    const dt = group[0].date ? String(group[0].date).slice(0, 10) : '-';
    const rcpt = cleanStr(group[0].receipt_no) || '-';

    let accSums = { '1': 0, '2': 0, '10': 0, '21': 0, '22': 0 };
    let rowTotal = 0;

    group.forEach(g => {
      const ac = cleanStr(g.account);
      const amt = parseFloat(g.amount_deposited) || 0;
      if (accSums[ac] !== undefined) accSums[ac] += amt;
      rowTotal += amt;
    });

    const safeGKey = String(gKey).replace(/'/g, "\\'");
    receiptRowsHtml += `
      <tr>
        <td>${dt}</td>
        <td><strong>${rcpt}</strong></td>
        ${accounts.map(ac => `<td class="text-end">${accSums[ac] > 0 ? fmtCur(accSums[ac]) : '-'}</td>`).join('')}
        <td class="text-end val-cleared">${fmtCur(rowTotal)}</td>
        <td class="text-center">
          <div style="display: inline-flex; gap: 6px; align-items: center; justify-content: center;">
            <button class="sidebar-btn btn-outline" style="width: 28px; height: 28px; padding: 0; margin: 0; display: inline-flex; align-items: center; justify-content: center;" title="Edit Receipt in Form Above" onclick="editReceiptGroupInline('${safeGKey}', ${row.id})">
              <i class="fas fa-edit" style="color: var(--accent);"></i>
            </button>
            <button class="sidebar-btn btn-outline" style="width: 28px; height: 28px; padding: 0; margin: 0; display: inline-flex; align-items: center; justify-content: center;" title="Delete Receipt" onclick="deleteReceiptGroup('${safeGKey}', ${row.id})">
              <i class="fas fa-trash-alt" style="color: var(--danger);"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
    rowIdx++;
  });

  if (!receiptRowsHtml) {
    receiptRowsHtml = `<tr><td colspan="9" class="text-center text-muted" style="padding: 16px;">No date-wise payment receipts recorded yet for this certificate.</td></tr>`;
  }

  const today = new Date().toISOString().split('T')[0];

  return `
    <div class="receipt-ledger-box">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 12px;">
        <i class="fas fa-book-open me-1" style="color: var(--accent);"></i> Date-Wise Payment Receipts Ledger (${type} — RRC: ${rrcNo})
      </div>

      <div class="receipt-form-grid" id="rcpt-form-grid-${row.id}">
        <div>
          <label class="form-label-sm">Date</label>
          <input type="date" id="rcpt-date-${row.id}" class="custom-input" value="${today}">
        </div>
        <div>
          <label class="form-label-sm">Receipt / Challan No</label>
          <input type="text" id="rcpt-no-${row.id}" class="custom-input" placeholder="CH-1001">
        </div>
        ${accounts.map(ac => `
          <div>
            <label class="form-label-sm">Acc ${ac} (₹)</label>
            <input type="number" id="rcpt-amt-${row.id}-${ac}" class="custom-input text-end" placeholder="0.00">
          </div>
        `).join('')}
        <div id="rcpt-btn-container-${row.id}">
          <button class="sidebar-btn btn-accent" style="width: 100%; margin: 0; padding: 10px;" onclick="saveReceiptEntry(${row.id})">
            <i class="fas fa-plus"></i> Record
          </button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="ledger-table" style="margin: 0;">
          <thead>
            <tr>
              <th>Payment Date</th>
              <th>Receipt No</th>
              <th class="text-end">Acc 1 (₹)</th>
              <th class="text-end">Acc 2 (₹)</th>
              <th class="text-end">Acc 10 (₹)</th>
              <th class="text-end">Acc 21 (₹)</th>
              <th class="text-end">Acc 22 (₹)</th>
              <th class="text-end">Total Paid (₹)</th>
              <th class="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            ${receiptRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------------
// Deposit Editing & Database Sync
// ------------------------------------------------------------------
function clearZeroOnClick(input) {
  const val = parseFloat(input.value.replace(/,/g, '')) || 0;
  if (val === 0) input.value = '';
}

async function onPaidEdited(rowId, ac) {
  const input = document.getElementById(`paid-in-${rowId}-${ac}`);
  const raw = input.value.replace(/,/g, '').trim();
  const newPaid = parseFloat(raw) || 0;

  const row = appData.master.find(r => r.id === rowId);
  if (!row) return;

  const ob = parseFloat(row[`acc_${ac}_ob`]) || 0;
  const newPending = ob - newPaid;

  row[`acc_${ac}_paid`] = newPaid;
  row[`acc_${ac}_pending`] = newPending;

  // Recompute Totals
  const accounts = ['1', '2', '10', '21', '22'];
  let totalOb = 0, totalPaid = 0, totalPending = 0;
  accounts.forEach(a => {
    totalOb += parseFloat(row[`acc_${a}_ob`]) || 0;
    totalPaid += parseFloat(row[`acc_${a}_paid`]) || 0;
    totalPending += parseFloat(row[`acc_${a}_pending`]) || 0;
  });

  row.recovery_ob = totalOb;
  row.recovered_curr_year = totalPaid;
  row.pending_curr_year = totalPending;

  // Fully Recovered Check
  let newlyRecovered = false;
  if (totalPending <= 0 && cleanStr(row.fully_recovered) !== 'Yes') {
    row.fully_recovered = 'Yes';
    newlyRecovered = true;

    // Log to fully_recovered_log
    const today = new Date();
    const monthStr = today.toLocaleString('default', { month: 'long', year: 'numeric' });
    const frEntry = {
      date: today.toISOString().split('T')[0],
      month: monthStr,
      est_name: cleanStr(row.est_name),
      est_code: cleanStr(row.est_code),
      rrc_no: cleanStr(row.rrc_no),
      type: cleanStr(row.type),
      period: cleanStr(row.period),
      total_due: totalOb,
      total_recovered: totalPaid
    };
    appData.fullyRecoveredLog.push(frEntry);
    await supabaseClient.from('fully_recovered_log').insert([frEntry]);
  } else if (totalPending > 0) {
    row.fully_recovered = '';
  }

  showSaveStatus('⏳ Syncing edit to Supabase...', 'var(--warning)');

  // Update rrc_master in Supabase
  const updatePayload = {
    [`acc_${ac}_paid`]: newPaid,
    [`acc_${ac}_pending`]: newPending,
    recovery_ob: totalOb,
    recovered_curr_year: totalPaid,
    pending_curr_year: totalPending,
    fully_recovered: row.fully_recovered
  };

  const { error } = await supabaseClient.from('rrc_master').update(updatePayload).eq('id', rowId);
  if (error) {
    showSaveStatus('⚠ Update failed: ' + error.message, 'var(--danger)');
    return;
  }

  showSaveStatus('✓ Saved to Supabase database', 'var(--success)');
  updateGlobalMetrics();

  // Refresh UI elements
  document.getElementById(`bal-lbl-${rowId}-${ac}`).textContent = fmtCur(newPending);
  document.getElementById(`bal-lbl-${rowId}-${ac}`).className = 'text-end ' + (newPending > 0 ? 'val-pending' : 'val-cleared');
  document.getElementById(`tot-paid-${rowId}`).textContent = fmtCur(totalPaid);
  document.getElementById(`tot-bal-${rowId}`).textContent = fmtCur(totalPending);
  document.getElementById(`tot-bal-${rowId}`).className = 'text-end ' + (totalPending > 0 ? 'val-pending' : 'val-cleared');

  if (newlyRecovered) {
    alert(`🎉 ${cleanStr(row.est_name)} (RRC: ${cleanStr(row.rrc_no)}, ${cleanStr(row.type)}) has been fully recovered!`);
    const selectBox = document.getElementById('matchedRecordsBox');
    displaySpecificRow(selectBox.value);
  }
}

// ------------------------------------------------------------------
// Record Payment Receipt
// ------------------------------------------------------------------
function refreshEstablishmentCardView(rowId, estCode) {
  const row = appData.master.find(r => r.id === rowId);
  const code = estCode || (row ? cleanStr(row.est_code) : '');

  // 1. Refresh inside Quick Establishment Ledger Modal if active
  const quickModal = document.getElementById('quickEstLedgerModal');
  if (quickModal && quickModal.classList.contains('active') && code) {
    let targetRrcId = null;
    let targetType = null;
    const activeBtn = quickModal.querySelector('.search-mode-btn.active');
    if (activeBtn && !activeBtn.textContent.includes('Show All')) {
      targetRrcId = rowId;
    }
    renderQuickEstCards(code, targetRrcId, targetType);
  }

  // 2. Refresh inside Main Establishment Search Tab if selected
  const selectBox = document.getElementById('matchedRecordsBox');
  if (selectBox && selectBox.value) {
    displaySpecificRow(selectBox.value);
  }
}

// ------------------------------------------------------------------
// Record Payment Receipt
// ------------------------------------------------------------------
async function saveReceiptEntry(rowId, editingGKey = null) {
  const row = appData.master.find(r => r.id === rowId);
  if (!row) return;

  const quickModal = document.getElementById('quickEstLedgerModal');
  const scope = (quickModal && quickModal.classList.contains('active')) ? quickModal : document;

  const dateInput = scope.querySelector(`#rcpt-date-${rowId}`) || document.getElementById(`rcpt-date-${rowId}`);
  const rcptInput = scope.querySelector(`#rcpt-no-${rowId}`) || document.getElementById(`rcpt-no-${rowId}`);

  if (!dateInput) {
    alert('Payment entry form not found.');
    return;
  }

  const dateVal = dateInput.value;
  const rcptNo = rcptInput ? rcptInput.value.trim() : '';

  if (!dateVal) {
    alert('Please enter a valid payment date.');
    return;
  }

  const accounts = ['1', '2', '10', '21', '22'];
  let newEntries = [];
  let txnId = 'TXN_' + Date.now();

  accounts.forEach(ac => {
    const input = scope.querySelector(`#rcpt-amt-${rowId}-${ac}`) || document.getElementById(`rcpt-amt-${rowId}-${ac}`);
    if (input) {
      const rawVal = String(input.value || '').replace(/,/g, '').trim();
      const amt = parseFloat(rawVal) || 0;
      if (amt > 0) {
        newEntries.push({
          txn_id: txnId,
          date: dateVal,
          receipt_no: rcptNo,
          est_name: cleanStr(row.est_name),
          est_code: cleanStr(row.est_code),
          rrc_no: cleanStr(row.rrc_no),
          type: cleanStr(row.type),
          account: ac,
          amount_deposited: amt,
          period: cleanStr(row.period)
        });
      }
    }
  });

  if (newEntries.length === 0) {
    alert('Please enter a deposit amount for at least one account.');
    return;
  }

  // If we are editing an existing receipt group, remove old entries first
  if (editingGKey) {
    showSaveStatus('⏳ Updating payment receipt in Supabase...', 'var(--warning)');

    const targetEstCode = cleanStr(row.est_code);
    const targetType = cleanStr(row.type);

    let toDelete = appData.recoveryLog.filter(l => {
      if (l.txn_id && l.txn_id === editingGKey) return true;
      const lDt = l.date ? String(l.date).slice(0, 10) : '';
      const lRcpt = cleanStr(l.receipt_no);
      const estC = cleanStr(l.est_code);
      const t = cleanStr(l.type);
      const matchesKey = (l.txn_id === editingGKey) || (`${l.date}___${l.receipt_no || ''}` === editingGKey) || (`${lDt}___${lRcpt}` === editingGKey) || (editingGKey.includes(lDt) && lRcpt && editingGKey.includes(lRcpt));
      return matchesKey && (estC === targetEstCode) && (t === targetType);
    });

    const deleteIds = toDelete.map(l => l.id).filter(Boolean);
    const deleteTxnIds = Array.from(new Set(toDelete.map(l => l.txn_id).filter(Boolean)));
    const toDeleteSet = new Set(toDelete);

    appData.recoveryLog = appData.recoveryLog.filter(l => !toDeleteSet.has(l) && (!l.id || !deleteIds.includes(l.id)));

    if (deleteTxnIds.length > 0) {
      for (const tId of deleteTxnIds) {
        await supabaseClient.from('recovery_log').delete().eq('txn_id', tId);
      }
    }
    if (deleteIds.length > 0) {
      await supabaseClient.from('recovery_log').delete().in('id', deleteIds);
    }
  } else {
    showSaveStatus('⏳ Recording receipt in Supabase...', 'var(--warning)');
  }

  const { data, error } = await supabaseClient.from('recovery_log').insert(newEntries).select();
  if (error) {
    showSaveStatus('⚠ Error saving receipt: ' + error.message, 'var(--danger)');
    alert('Error saving receipt: ' + error.message);
    return;
  }

  appData.recoveryLog = (data || newEntries).concat(appData.recoveryLog);

  // Recalculate Account Paid Totals for this certificate
  const estCode = cleanStr(row.est_code);
  const type = cleanStr(row.type);

  for (const ac of accounts) {
    const certLogs = appData.recoveryLog.filter(l => cleanStr(l.est_code) === estCode && cleanStr(l.type) === type && cleanStr(l.account) === ac);
    const acTotalPaid = certLogs.reduce((sum, l) => sum + (parseFloat(l.amount_deposited) || 0), 0);
    const ob = parseFloat(row[`acc_${ac}_ob`]) || 0;
    const pending = ob - acTotalPaid;

    row[`acc_${ac}_paid`] = acTotalPaid;
    row[`acc_${ac}_pending`] = pending;
  }

  // Rollup Totals
  let totalOb = 0, totalPaid = 0, totalPending = 0;
  accounts.forEach(a => {
    totalOb += parseFloat(row[`acc_${a}_ob`]) || 0;
    totalPaid += parseFloat(row[`acc_${a}_paid`]) || 0;
    totalPending += parseFloat(row[`acc_${a}_pending`]) || 0;
  });

  row.recovery_ob = totalOb;
  row.recovered_curr_year = totalPaid;
  row.pending_curr_year = totalPending;
  if (totalPending <= 0) row.fully_recovered = 'Yes';
  else row.fully_recovered = '';

  await supabaseClient.from('rrc_master').update({
    acc_1_paid: row.acc_1_paid, acc_1_pending: row.acc_1_pending,
    acc_2_paid: row.acc_2_paid, acc_2_pending: row.acc_2_pending,
    acc_10_paid: row.acc_10_paid, acc_10_pending: row.acc_10_pending,
    acc_21_paid: row.acc_21_paid, acc_21_pending: row.acc_21_pending,
    acc_22_paid: row.acc_22_paid, acc_22_pending: row.acc_22_pending,
    recovery_ob: totalOb, recovered_curr_year: totalPaid, pending_curr_year: totalPending,
    fully_recovered: row.fully_recovered
  }).eq('id', rowId);

  showSaveStatus(editingGKey ? '✓ Receipt updated & synced successfully!' : '✓ Receipt recorded & synced successfully!', 'var(--success)');
  updateGlobalMetrics();
  refreshEstablishmentCardView(rowId, estCode);
}

async function deleteReceiptGroup(gKey, rowId) {
  if (!confirm('Are you sure you want to delete this payment receipt record?')) return;

  showSaveStatus('⏳ Deleting receipt...', 'var(--warning)');

  const targetRow = appData.master.find(r => r.id === rowId);
  const targetEstCode = targetRow ? cleanStr(targetRow.est_code) : '';
  const targetType = targetRow ? cleanStr(targetRow.type) : '';

  // 1. Identify all matching receipt log records in appData.recoveryLog
  let toDelete = appData.recoveryLog.filter(l => {
    if (l.txn_id && l.txn_id === gKey) return true;

    const lDt = l.date ? String(l.date).slice(0, 10) : '';
    const lRcpt = cleanStr(l.receipt_no);
    const estC = cleanStr(l.est_code);
    const t = cleanStr(l.type);

    const matchesKey = (l.txn_id === gKey) ||
                       (`${l.date}___${l.receipt_no || ''}` === gKey) ||
                       (`${lDt}___${lRcpt}` === gKey) ||
                       (gKey.includes(lDt) && lRcpt && gKey.includes(lRcpt));

    const matchesCert = (estC === targetEstCode) && (t === targetType);
    return matchesKey && matchesCert;
  });

  // Fallback: If no match with cert check, try global key match
  if (toDelete.length === 0) {
    toDelete = appData.recoveryLog.filter(l => {
      if (l.txn_id && l.txn_id === gKey) return true;
      const lDt = l.date ? String(l.date).slice(0, 10) : '';
      const lRcpt = cleanStr(l.receipt_no);
      return (`${l.date}___${l.receipt_no || ''}` === gKey) || (`${lDt}___${lRcpt}` === gKey) || (gKey.includes(lDt) && lRcpt && gKey.includes(lRcpt));
    });
  }

  if (toDelete.length === 0) {
    showSaveStatus('⚠ Receipt record not found in log', 'var(--danger)');
    alert('Could not locate the receipt record to delete.');
    return;
  }

  // 2. Remove from local memory state
  const deleteIds = toDelete.map(l => l.id).filter(Boolean);
  const deleteTxnIds = Array.from(new Set(toDelete.map(l => l.txn_id).filter(Boolean)));
  const toDeleteSet = new Set(toDelete);

  appData.recoveryLog = appData.recoveryLog.filter(l => !toDeleteSet.has(l) && (!l.id || !deleteIds.includes(l.id)));

  // 3. Perform Supabase deletion for ALL matched rows with triple failsafe
  if (deleteTxnIds.length > 0) {
    for (const tId of deleteTxnIds) {
      const { error } = await supabaseClient.from('recovery_log').delete().eq('txn_id', tId);
      if (error) console.error('Supabase txn_id delete error:', error);
    }
  }

  if (deleteIds.length > 0) {
    const { error } = await supabaseClient.from('recovery_log').delete().in('id', deleteIds);
    if (error) console.error('Supabase ID array delete error:', error);
  }

  // Fallback deletion matching properties in Supabase
  if (toDelete.length > 0) {
    for (const item of toDelete) {
      let q = supabaseClient.from('recovery_log').delete()
        .eq('est_code', cleanStr(item.est_code))
        .eq('type', cleanStr(item.type));

      if (item.receipt_no) q = q.eq('receipt_no', cleanStr(item.receipt_no));
      if (item.account) q = q.eq('account', cleanStr(item.account));

      const { error } = await q;
      if (error) console.error('Supabase fallback property delete error:', error);
    }
  }

  // 4. Recalculate certificate totals
  let estCode = targetEstCode;
  const row = targetRow || appData.master.find(r => r.id === rowId);
  if (row) {
    if (!estCode) estCode = cleanStr(row.est_code);
    const accounts = ['1', '2', '10', '21', '22'];
    const type = cleanStr(row.type);

    for (const ac of accounts) {
      const certLogs = appData.recoveryLog.filter(l => cleanStr(l.est_code) === estCode && cleanStr(l.type) === type && cleanStr(l.account) === ac);
      const acTotalPaid = certLogs.reduce((sum, l) => sum + (parseFloat(l.amount_deposited) || 0), 0);
      const ob = parseFloat(row[`acc_${ac}_ob`]) || 0;

      row[`acc_${ac}_paid`] = acTotalPaid;
      row[`acc_${ac}_pending`] = ob - acTotalPaid;
    }

    let totalOb = 0, totalPaid = 0, totalPending = 0;
    accounts.forEach(a => {
      totalOb += parseFloat(row[`acc_${a}_ob`]) || 0;
      totalPaid += parseFloat(row[`acc_${a}_paid`]) || 0;
      totalPending += parseFloat(row[`acc_${a}_pending`]) || 0;
    });

    row.recovery_ob = totalOb;
    row.recovered_curr_year = totalPaid;
    row.pending_curr_year = totalPending;
    if (totalPending > 0) row.fully_recovered = '';

    await supabaseClient.from('rrc_master').update({
      acc_1_paid: row.acc_1_paid, acc_1_pending: row.acc_1_pending,
      acc_2_paid: row.acc_2_paid, acc_2_pending: row.acc_2_pending,
      acc_10_paid: row.acc_10_paid, acc_10_pending: row.acc_10_pending,
      acc_21_paid: row.acc_21_paid, acc_21_pending: row.acc_21_pending,
      acc_22_paid: row.acc_22_paid, acc_22_pending: row.acc_22_pending,
      recovery_ob: totalOb, recovered_curr_year: totalPaid, pending_curr_year: totalPending,
      fully_recovered: row.fully_recovered
    }).eq('id', rowId);
  }

  showSaveStatus('✓ Receipt deleted & totals updated', 'var(--success)');
  updateGlobalMetrics();
  refreshEstablishmentCardView(rowId, estCode);
}

// ------------------------------------------------------------------
// Inline Payment Receipt Edit via Top Form (No Popup Modal)
// ------------------------------------------------------------------
function editReceiptGroupInline(gKey, rowId) {
  const row = appData.master.find(r => r.id === rowId);
  if (!row) return;

  const quickModal = document.getElementById('quickEstLedgerModal');
  const scope = (quickModal && quickModal.classList.contains('active')) ? quickModal : document;

  const targetEstCode = cleanStr(row.est_code);
  const targetType = cleanStr(row.type);

  // Find matching log entries
  const group = appData.recoveryLog.filter(l => {
    if (l.txn_id && l.txn_id === gKey) return true;
    const lDt = l.date ? String(l.date).slice(0, 10) : '';
    const lRcpt = cleanStr(l.receipt_no);
    const estC = cleanStr(l.est_code);
    const t = cleanStr(l.type);

    const matchesKey = (l.txn_id === gKey) ||
                       (`${l.date}___${l.receipt_no || ''}` === gKey) ||
                       (`${lDt}___${lRcpt}` === gKey) ||
                       (gKey.includes(lDt) && lRcpt && gKey.includes(lRcpt));

    return matchesKey && (estC === targetEstCode) && (t === targetType);
  });

  if (group.length === 0) {
    alert('Could not locate the receipt record to edit.');
    return;
  }

  const dt = group[0].date ? String(group[0].date).slice(0, 10) : new Date().toISOString().split('T')[0];
  const rcptNo = cleanStr(group[0].receipt_no);

  let accSums = { '1': 0, '2': 0, '10': 0, '21': 0, '22': 0 };
  group.forEach(g => {
    const ac = cleanStr(g.account);
    const amt = parseFloat(g.amount_deposited) || 0;
    if (accSums[ac] !== undefined) accSums[ac] += amt;
  });

  // Populate inputs in scope
  const dateInput = scope.querySelector(`#rcpt-date-${rowId}`);
  const rcptInput = scope.querySelector(`#rcpt-no-${rowId}`);
  const btnContainer = scope.querySelector(`#rcpt-btn-container-${rowId}`);
  const formGrid = scope.querySelector(`#rcpt-form-grid-${rowId}`);

  if (dateInput) dateInput.value = dt;
  if (rcptInput) rcptInput.value = rcptNo;

  const accounts = ['1', '2', '10', '21', '22'];
  accounts.forEach(ac => {
    const amtInput = scope.querySelector(`#rcpt-amt-${rowId}-${ac}`);
    if (amtInput) {
      const val = accSums[ac];
      amtInput.value = val > 0 ? val : '';
    }
  });

  if (formGrid) {
    formGrid.style.border = '2px solid var(--accent)';
    formGrid.style.borderRadius = '8px';
    formGrid.style.padding = '10px';
    formGrid.style.background = 'rgba(108, 92, 231, 0.08)';
    formGrid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  const safeGKey = String(gKey).replace(/'/g, "\\'");
  if (btnContainer) {
    btnContainer.innerHTML = `
      <div style="display: flex; gap: 6px;">
        <button class="sidebar-btn btn-success" style="flex: 1; margin: 0; padding: 10px; font-weight: 700;" onclick="saveReceiptEntry(${rowId}, '${safeGKey}')" title="Save updated payment record">
          <i class="fas fa-check me-1"></i> Update
        </button>
        <button class="sidebar-btn btn-outline" style="width: 38px; margin: 0; padding: 10px; display: inline-flex; align-items: center; justify-content: center;" title="Cancel Edit" onclick="cancelReceiptEdit(${rowId})">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }
}

function cancelReceiptEdit(rowId) {
  const quickModal = document.getElementById('quickEstLedgerModal');
  const scope = (quickModal && quickModal.classList.contains('active')) ? quickModal : document;

  const dateInput = scope.querySelector(`#rcpt-date-${rowId}`);
  const rcptInput = scope.querySelector(`#rcpt-no-${rowId}`);
  const btnContainer = scope.querySelector(`#rcpt-btn-container-${rowId}`);
  const formGrid = scope.querySelector(`#rcpt-form-grid-${rowId}`);

  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (rcptInput) rcptInput.value = '';

  const accounts = ['1', '2', '10', '21', '22'];
  accounts.forEach(ac => {
    const amtInput = scope.querySelector(`#rcpt-amt-${rowId}-${ac}`);
    if (amtInput) amtInput.value = '';
  });

  if (formGrid) {
    formGrid.style.border = '';
    formGrid.style.borderRadius = '';
    formGrid.style.padding = '';
    formGrid.style.background = '';
  }

  if (btnContainer) {
    btnContainer.innerHTML = `
      <button class="sidebar-btn btn-accent" style="width: 100%; margin: 0; padding: 10px;" onclick="saveReceiptEntry(${rowId})">
        <i class="fas fa-plus"></i> Record
      </button>
    `;
  }
}

// ------------------------------------------------------------------
// Account Payment History Modal
// ------------------------------------------------------------------
function showAccountHistory(rowId, ac) {
  const row = appData.master.find(r => r.id === rowId);
  if (!row) return;

  appData.activeAccHist = { rowId, ac };

  const estName = cleanStr(row.est_name);
  const estCode = cleanStr(row.est_code);
  const rrcNo = cleanStr(row.rrc_no);
  const type = cleanStr(row.type);
  const period = cleanStr(row.period);

  document.getElementById('histModalTitle').textContent = `Account ${ac} Payment History — ${estName}`;
  document.getElementById('histModalSubhead').textContent = `${estName} (${estCode}) • RRC: ${rrcNo} • Type: ${type} • Period: ${period}`;

  const due = parseFloat(row[`acc_${ac}_ob`]) || 0;
  const paid = parseFloat(row[`acc_${ac}_paid`]) || 0;
  const bal = due - paid;

  document.getElementById('histDueLbl').innerHTML = `<strong>Dues OB:</strong> ${fmtCur(due)}`;
  document.getElementById('histPaidLbl').innerHTML = `<strong>Total Deposited:</strong> ${fmtCur(paid)}`;
  document.getElementById('histBalLbl').innerHTML = `<strong>Outstanding Balance:</strong> <span class="${bal > 0 ? 'val-pending' : 'val-cleared'}">${fmtCur(bal)}</span>`;

  refreshAccountHistoryTable(rrcNo, ac);
  openModal('accountHistoryModal');
}

function refreshAccountHistoryTable(rrcNo, ac) {
  const tbody = document.getElementById('histTableBody');
  tbody.innerHTML = '';

  const logs = appData.recoveryLog.filter(l => cleanStr(l.rrc_no) === rrcNo && cleanStr(l.account) === String(ac));
  logs.sort((a, b) => {
    const dtA = a.date ? new Date(a.date).getTime() : 0;
    const dtB = b.date ? new Date(b.date).getTime() : 0;
    if (dtA !== dtB) return dtB - dtA;
    return (b.id || 0) - (a.id || 0);
  });

  if (logs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted" style="padding: 20px;">No date-wise payment entries logged yet for this account.</td></tr>`;
    return;
  }

  logs.forEach(rec => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${rec.date ? String(rec.date).slice(0, 10) : 'N/A'}</td>
      <td>Account ${ac}</td>
      <td class="text-end val-cleared">${fmtCur(rec.amount_deposited)}</td>
      <td>${cleanStr(rec.period) || 'N/A'}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function submitPopPayment() {
  if (!appData.activeAccHist) return;

  const { rowId, ac } = appData.activeAccHist;
  const dateVal = document.getElementById('popPayDate').value;
  const amtVal = parseFloat(document.getElementById('popPayAmt').value) || 0;

  if (amtVal <= 0 || !dateVal) {
    alert('Please enter a valid positive amount and date.');
    return;
  }

  const row = appData.master.find(r => r.id === rowId);
  if (!row) return;

  const prevPaid = parseFloat(row[`acc_${ac}_paid`]) || 0;
  const newPaid = prevPaid + amtVal;

  input = document.getElementById(`paid-in-${rowId}-${ac}`);
  if (input) input.value = newPaid.toFixed(2);

  await onPaidEdited(rowId, ac);

  // Add entry to recovery_log
  const logEntry = {
    txn_id: 'TXN_' + Date.now(),
    date: dateVal,
    receipt_no: 'PARTIAL-' + Date.now().toString().slice(-4),
    est_name: cleanStr(row.est_name),
    est_code: cleanStr(row.est_code),
    rrc_no: cleanStr(row.rrc_no),
    type: cleanStr(row.type),
    account: ac,
    amount_deposited: amtVal,
    period: cleanStr(row.period)
  };

  await supabaseClient.from('recovery_log').insert([logEntry]);
  appData.recoveryLog.push(logEntry);

  document.getElementById('popPayAmt').value = '';
  showAccountHistory(rowId, ac);
}

// ------------------------------------------------------------------
// Month-Wise Recovery Report Modal
// ------------------------------------------------------------------
function showMonthlyReport() {
  const container = document.getElementById('monthlyReportBody');
  container.innerHTML = '';

  if (appData.recoveryLog.length === 0) {
    container.innerHTML = `<div class="text-center text-muted" style="padding: 40px;">No date-wise deposit entries logged yet in Supabase.</div>`;
    openModal('monthlyReportModal');
    return;
  }

  // Parse dates and group by Month YYYY-MM
  let monthlyMap = {};
  appData.recoveryLog.forEach(l => {
    if (!l.date) return;
    const monthKey = String(l.date).slice(0, 7); // YYYY-MM
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = [];
    monthlyMap[monthKey].push(l);
  });

  const sortedMonths = Object.keys(monthlyMap).sort().reverse();
  let grandTotal = 0;
  let typeOrder = ['7A', '14B', '7Q'];
  let grandTypeTotals = { '7A': 0, '14B': 0, '7Q': 0 };

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>RRC No</th>
            <th>EST Code</th>
            <th>EST Name</th>
            <th>Type</th>
            <th>Account</th>
            <th class="text-end">Amount Deposited (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  sortedMonths.forEach(mKey => {
    const logs = monthlyMap[mKey];
    const monthName = new Date(mKey + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' });
    let monthSubtotal = 0;
    let monthTypeTotals = { '7A': 0, '14B': 0, '7Q': 0 };

    logs.forEach(l => {
      const amt = parseFloat(l.amount_deposited) || 0;
      monthSubtotal += amt;
      grandTotal += amt;

      const t = cleanStr(l.type);
      if (monthTypeTotals[t] !== undefined) monthTypeTotals[t] += amt;
      if (grandTypeTotals[t] !== undefined) grandTypeTotals[t] += amt;

      html += `
        <tr>
          <td><strong>${monthName}</strong></td>
          <td>${cleanStr(l.rrc_no)}</td>
          <td>${cleanStr(l.est_code)}</td>
          <td>${cleanStr(l.est_name)}</td>
          <td><span class="type-badge">${cleanStr(l.type)}</span></td>
          <td>Account ${cleanStr(l.account)}</td>
          <td class="text-end val-cleared">${fmtCur(amt)}</td>
        </tr>
      `;
    });

    // Subtotal Row
    html += `
      <tr style="background: var(--bg-card-alt); font-weight: 700;">
        <td colspan="6">${monthName} — Subtotal</td>
        <td class="text-end val-cleared">${fmtCur(monthSubtotal)}</td>
      </tr>
      <tr style="background: var(--bg-main); font-size: 11px; color: var(--accent);">
        <td colspan="7">
          7A Total: <strong>${fmtCur(monthTypeTotals['7A'])}</strong> &nbsp;|&nbsp;
          14B Total: <strong>${fmtCur(monthTypeTotals['14B'])}</strong> &nbsp;|&nbsp;
          7Q Total: <strong>${fmtCur(monthTypeTotals['7Q'])}</strong>
        </td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row" style="font-size: 14px;">
          <td colspan="6">GRAND TOTAL</td>
          <td class="text-end val-cleared">${fmtCur(grandTotal)}</td>
        </tr>
        <tr style="background: var(--bg-main); font-weight: 700; color: var(--success);">
          <td colspan="7">
            7A Grand Total: ${fmtCur(grandTypeTotals['7A'])} &nbsp;|&nbsp;
            14B Grand Total: ${fmtCur(grandTypeTotals['14B'])} &nbsp;|&nbsp;
            7Q Grand Total: ${fmtCur(grandTypeTotals['7Q'])}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  `;

  container.innerHTML = html;
  openModal('monthlyReportModal');
}

// ------------------------------------------------------------------
// Fully Recovered Report Modal
// ------------------------------------------------------------------
function showFullyRecoveredReport() {
  const container = document.getElementById('fullyRecoveredReportBody');
  container.innerHTML = '';

  const clearedMaster = appData.master.filter(r => cleanStr(r.fully_recovered) === 'Yes' || (parseFloat(r.pending_curr_year) || 0) <= 0);

  if (clearedMaster.length === 0) {
    container.innerHTML = `<div class="text-center text-muted" style="padding: 40px;">No establishments have been marked fully recovered yet.</div>`;
    openModal('fullyRecoveredReportModal');
    return;
  }

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>#</th>
            <th>RRC No</th>
            <th>EST Code</th>
            <th>EST Name</th>
            <th>Type</th>
            <th class="text-end">Total Due (₹)</th>
            <th class="text-end">Total Recovered (₹)</th>
            <th class="text-center">Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  clearedMaster.forEach((r, idx) => {
    html += `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${cleanStr(r.rrc_no)}</strong></td>
        <td>${cleanStr(r.est_code)}</td>
        <td>${cleanStr(r.est_name)}</td>
        <td><span class="type-badge">${cleanStr(r.type)}</span></td>
        <td class="text-end">${fmtCur(r.recovery_ob)}</td>
        <td class="text-end val-cleared">${fmtCur(r.recovered_curr_year)}</td>
        <td class="text-center"><span class="recovered-badge"><i class="fas fa-check-circle me-1"></i> Fully Recovered</span></td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row">
          <td colspan="5">Grand Total (${clearedMaster.length} Establishments Cleared)</td>
          <td class="text-end">${fmtCur(clearedMaster.reduce((s, r) => s + (parseFloat(r.recovery_ob) || 0), 0))}</td>
          <td class="text-end val-cleared">${fmtCur(clearedMaster.reduce((s, r) => s + (parseFloat(r.recovered_curr_year) || 0), 0))}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>
  `;

  container.innerHTML = html;
  openModal('fullyRecoveredReportModal');
}

// ------------------------------------------------------------------
// CSV Export Functions
// ------------------------------------------------------------------
function exportMonthlyReportCsv() {
  if (appData.recoveryLog.length === 0) return alert('No data to export.');
  let csv = 'Date,RRC No,EST Code,EST Name,Type,Account,Amount Deposited,Period\n';
  appData.recoveryLog.forEach(l => {
    csv += `"${l.date || ''}","${cleanStr(l.rrc_no)}","${cleanStr(l.est_code)}","${cleanStr(l.est_name)}","${cleanStr(l.type)}","Account ${cleanStr(l.account)}",${l.amount_deposited || 0},"${cleanStr(l.period)}"\n`;
  });
  downloadCsvFile(csv, 'Monthly_Recovery_Report.csv');
}

function exportFullyRecoveredCsv() {
  const cleared = appData.master.filter(r => cleanStr(r.fully_recovered) === 'Yes' || (parseFloat(r.pending_curr_year) || 0) <= 0);
  if (cleared.length === 0) return alert('No data to export.');
  let csv = 'RRC No,EST Code,EST Name,Type,Total Due,Total Recovered,Status\n';
  cleared.forEach(r => {
    csv += `"${cleanStr(r.rrc_no)}","${cleanStr(r.est_code)}","${cleanStr(r.est_name)}","${cleanStr(r.type)}",${r.recovery_ob || 0},${r.recovered_curr_year || 0},"Fully Recovered"\n`;
  });
  downloadCsvFile(csv, 'Fully_Recovered_Report.csv');
}

function downloadCsvFile(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ------------------------------------------------------------------
// Release History & Changelog Modal
// ------------------------------------------------------------------
function showVersionHistoryModal() {
  const container = document.getElementById('versionHistoryModalBody');
  if (!container) return;

  let html = `<div style="display: flex; flex-direction: column; gap: 16px;">`;

  APP_RELEASE_LOG.forEach((rel, idx) => {
    const isCurrent = rel.version === APP_VERSION;
    const badgeBg = isCurrent ? 'rgba(46, 204, 113, 0.15)' : 'rgba(108, 92, 231, 0.15)';
    const badgeColor = isCurrent ? '#2ecc71' : 'var(--accent)';
    const currentLabel = isCurrent ? '<span style="background: #2ecc71; color:#fff; font-size:10px; padding:2px 8px; border-radius:10px; font-weight:700; margin-left:8px;">CURRENT BUILD</span>' : '';

    let bulletItems = '';
    rel.changes.forEach(c => {
      bulletItems += `<li style="margin-bottom: 5px; color: var(--text-primary); font-size: 12px; display: flex; align-items: flex-start; gap: 8px;"><i class="fas fa-check-circle me-1" style="color: #2ecc71; font-size: 11px; margin-top: 3px;"></i> <span>${c}</span></li>`;
    });

    html += `
      <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; border: 1px solid ${badgeColor};">
              <i class="fas fa-code-branch me-1"></i> ${rel.version}
            </span>
            ${currentLabel}
          </div>
          <span style="font-size: 11px; color: var(--text-secondary); font-weight: 600;"><i class="far fa-calendar-alt me-1"></i> ${rel.date}</span>
        </div>
        <h4 style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; color: var(--text-primary);">${rel.title}</h4>
        <ul style="margin: 0; padding-left: 0; list-style: none;">
          ${bulletItems}
        </ul>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
  openModal('versionHistoryModal');
}

function exportVersionLogCsv() {
  let csv = 'Version,Release Date,Release Title,Update Details\n';
  APP_RELEASE_LOG.forEach(rel => {
    rel.changes.forEach(c => {
      csv += `"${rel.version}","${rel.date}","${rel.title}","${c.replace(/"/g, '""')}"\n`;
    });
  });
  downloadCsvFile(csv, 'RRC_Manager_Version_Changelog.csv');
}

// ------------------------------------------------------------------
// High-Precision Official Vector PDF Export Engine (jsPDF + AutoTable)
// ------------------------------------------------------------------
function generateReportPdf(reportTitle, reportSubhead, containerId, orientation = 'landscape') {
  const container = document.getElementById(containerId);
  if (!container) return alert('Report content not found.');
  const tableEl = container.querySelector('table.ledger-table');
  if (!tableEl) return alert('Report table not found.');

  if (!window.jspdf || !window.jspdf.jsPDF) {
    return alert('PDF Generation library is loading. Please try again in a moment.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Official Dark EPFO Blue Header Banner
  doc.setFillColor(30, 30, 45);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("EMPLOYEES' PROVIDENT FUND ORGANISATION", 14, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text("REGIONAL OFFICE, CUTTACK — RECOVERY CERTIFICATE MASTER SYSTEM", 14, 16);

  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(8);
  doc.text(`Generated: ${todayStr}`, pageWidth - 14, 16, { align: 'right' });

  // Report Title & Subtitle
  doc.setTextColor(30, 30, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(reportTitle.toUpperCase(), 14, 31);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(reportSubhead, 14, 36);

  // Parse Table Content
  // Parse Table Content with precise glyph conversion (₹ -> Rs.) for helvetica font metric alignment
  const headRows = [];
  const bodyRows = [];
  const footRows = [];

  const headers = Array.from(tableEl.querySelectorAll('thead th')).map(th => {
    let txt = th.textContent.replace(/[▲▼↕]/g, '').trim();
    return txt.replace(/₹\s?/g, 'Rs. ');
  });
  headRows.push(headers);

  const trs = Array.from(tableEl.querySelectorAll('tbody tr'));
  trs.forEach(tr => {
    const cells = Array.from(tr.children).map(td => {
      let txt = td.textContent.trim();
      return txt.replace(/₹\s?/g, 'Rs. ');
    });
    if (tr.classList.contains('total-row')) {
      footRows.push(cells);
    } else {
      bodyRows.push(cells);
    }
  });

  // Alignment per column (Right alignment for all monetary & percentage figures)
  const colStyles = {};
  headers.forEach((h, idx) => {
    const txt = h.toLowerCase();
    if (txt.includes('amount') || txt.includes('due') || txt.includes('paid') || txt.includes('ob') || txt.includes('pending') || txt.includes('rs') || txt.includes('recovered') || txt.includes('rupees') || txt.includes('%') || txt.includes('acc')) {
      colStyles[idx] = { halign: 'right', fontStyle: 'bold', overflow: 'linebreak' };
    } else if (txt.includes('sl') || txt.includes('rank') || txt.includes('type') || txt.includes('rrcs') || txt.includes('count') || txt.includes('vintage')) {
      colStyles[idx] = { halign: 'center' };
    } else {
      colStyles[idx] = { halign: 'left', overflow: 'linebreak' };
    }
  });

  doc.autoTable({
    head: headRows,
    body: bodyRows,
    foot: footRows.length > 0 ? footRows : undefined,
    startY: 40,
    margin: { top: 40, left: 10, right: 10, bottom: 14 },
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 1.8,
      lineColor: [220, 224, 230],
      lineWidth: 0.1,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [30, 30, 45],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'center'
    },
    footStyles: {
      fillColor: [235, 238, 243],
      textColor: [30, 30, 45],
      fontStyle: 'bold',
      fontSize: 7.5
    },
    columnStyles: colStyles,
    alternateRowStyles: {
      fillColor: [248, 249, 250]
    },
    // Two-pass footer: collect page positions during draw, stamp totals after autoTable
    didDrawPage: function (data) {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      // Left-side label (same on every page)
      doc.text('EPFO Cuttack \u2014 Official Recovery Certificate Management System', 10, pageH - 6);
      // Right-side placeholder: write current page number now; total will be overwritten below
      doc.text(`Page ${data.pageNumber}`, pageWidth - 10, pageH - 6, { align: 'right' });
    }
  });

  // --- Two-pass: now stamp correct "Page X of N" on every page ---
  const totalPages = doc.internal.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // White-out the old placeholder on the right side
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - 45, pageH - 12, 40, 10, 'F');
    // Stamp the correct "Page X of N"
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageH - 6, { align: 'right' });
  }

  const cleanFileName = reportTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
  doc.save(cleanFileName);
}

// ------------------------------------------------------------------
// Data-Driven PDF Export (bypasses DOM, uses full data arrays)
// Used for paginated modals where the DOM only shows 1 page at a time
// ------------------------------------------------------------------
function generateDataPdf(reportTitle, reportSubhead, headers, bodyRows, orientation = 'landscape') {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return alert('PDF Generation library is loading. Please try again in a moment.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header banner
  doc.setFillColor(30, 30, 45);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text("EMPLOYEES' PROVIDENT FUND ORGANISATION", 14, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text("REGIONAL OFFICE, CUTTACK \u2014 RECOVERY CERTIFICATE MASTER SYSTEM", 14, 16);
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(8);
  doc.text(`Generated: ${todayStr}`, pageWidth - 14, 16, { align: 'right' });

  // Title & subtitle
  doc.setTextColor(30, 30, 45);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(reportTitle.toUpperCase(), 14, 31);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 100, 100);
  doc.text(reportSubhead, 14, 36);

  // Column alignment
  const colStyles = {};
  headers.forEach((h, idx) => {
    const txt = h.toLowerCase();
    if (txt.includes('amount') || txt.includes('due') || txt.includes('paid') || txt.includes('ob') || txt.includes('pending') || txt.includes('rs') || txt.includes('recovered') || txt.includes('%') || txt.includes('acc')) {
      colStyles[idx] = { halign: 'right', fontStyle: 'bold', overflow: 'linebreak' };
    } else if (txt.includes('sl') || txt.includes('rank') || txt.includes('type') || txt.includes('rrcs') || txt.includes('count') || txt.includes('vintage')) {
      colStyles[idx] = { halign: 'center' };
    } else {
      colStyles[idx] = { halign: 'left', overflow: 'linebreak' };
    }
  });

  doc.autoTable({
    head: [headers],
    body: bodyRows,
    startY: 40,
    margin: { top: 40, left: 10, right: 10, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1.8, lineColor: [220, 224, 230], lineWidth: 0.1, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 30, 45], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5, halign: 'center' },
    columnStyles: colStyles,
    alternateRowStyles: { fillColor: [248, 249, 250] },
    didDrawPage: function (data) {
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('EPFO Cuttack \u2014 Official Recovery Certificate Management System', 10, pageH - 6);
    }
  });

  // Two-pass page numbering
  const totalPages = doc.internal.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - 45, pageH - 12, 40, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 10, pageH - 6, { align: 'right' });
  }

  doc.save(reportTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');
}

// Individual PDF Exporters for Reports
// Paginated modals use generateDataPdf with full data arrays; non-paginated use generateReportPdf from DOM
function exportDefaultersPdf() {
  const labelMap = { pending: 'Pending Amount', total_dues: 'Total Dues OB', recovered: 'Total Payment Received', est_name: 'Establishment Name', est_code: 'EST Code', type: 'Type', rrc_no: 'RRC No', period: 'Period', district: 'District' };
  const sortLabel = labelMap[_defaultersSortKey] || _defaultersSortKey;
  const headers = ['Sl.No', 'EST Code', 'Establishment Name', 'Type', 'RRC No', 'Period', 'District', 'Total Dues OB (Rs.)', 'Total Payment Received (Rs.)', 'Pending Amount (Rs.)'];
  const rows = _defaultersRecords.map((r, i) => [
    i + 1, cleanStr(r.est_code), cleanStr(r.est_name), cleanStr(r.type),
    cleanStr(r.rrc_no), cleanStr(r.period) || '-', cleanStr(r.district) || 'N/A',
    fmtCur(parseFloat(r.recovery_ob) || 0).replace(/₹/g, 'Rs.'),
    fmtCur(parseFloat(r.recovered_curr_year) || 0).replace(/₹/g, 'Rs.'),
    fmtCur(parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0).replace(/₹/g, 'Rs.')
  ]);
  generateDataPdf('Top Defaulters Watchlist Report', `${rows.length} Establishments — Sorted by ${sortLabel} (${_defaultersSortAsc ? 'Ascending' : 'Descending'})`, headers, rows);
}
function exportDistrictPdf() { generateReportPdf('District & Geographical Recovery Analytics Report', 'Recovery Performance and Dues Distribution across Districts & Offices', 'districtModalBody', 'landscape'); }
function exportRoPdf() { generateReportPdf('Recovery Officers (RO) Performance Matrix', 'Assigned RRCs, Total Dues OB and Recoveries per Recovery Officer', 'roModalBody', 'landscape'); }
function exportAgeingPdf() { generateReportPdf('RRC Certificate Ageing & Vintage Analysis Report', 'Breakdown of Pending Certificates by Vintage Age Buckets', 'ageingModalBody', 'landscape'); }
function exportActionPdf() { generateReportPdf('Action Taken & Legal Stage Tracker Report', 'Bank Attachment, Arrest Warrants, Property Attachment & Legal Status', 'actionModalBody', 'landscape'); }
function exportModePdf() { generateReportPdf('Collection Mode & Receipt Channel Report', 'Demand Draft, Cheque, Online/RTGS & Bank Recovery Receipts', 'modeModalBody', 'landscape'); }
function exportAccountSplitPdf() { generateReportPdf('5-Account Wise Revenue Split Report', 'EPF Accounts 1, 2, 10, 21 & 22 Distribution Breakdown', 'accountSplitModalBody', 'landscape'); }
function exportEoReportPdf() { generateReportPdf('Enforcement Officers (EO) Recovery Performance History', 'Historical Recovery Performance Broken Down by Enforcement Officer & Month', 'eoReportBody', 'landscape'); }
function exportMonthlyReportPdf() { generateReportPdf('Month-wise Recovery Report', 'Grouped by Payment Dates Recorded in Supabase', 'monthlyReportBody', 'portrait'); }
function exportFullyRecoveredPdf() { generateReportPdf('Fully Recovered Establishments Report', 'Establishments whose Outstanding Recovery Balance Reached Zero', 'fullyRecoveredReportBody', 'portrait'); }

// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Modal UI Helpers & Interactive Table Column Sorting
// ------------------------------------------------------------------
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('active');
    setTimeout(() => {
      const table = el.querySelector('table.ledger-table');
      if (table) makeTableSortable(table);
    }, 50);
  }
}

function getCertificateLegalWeight(typeStr) {
  const t = (typeStr || '').trim().toUpperCase();
  if (t === '7A') return 10;
  if (t === '14B') return 30;
  if (t === '7Q') return 20;
  return 50;
}

function makeSortableTh(title, key, currentKey, isAsc, fnName, alignClass = '') {
  const isActive = currentKey === key;
  const arrow = isActive ? (isAsc ? ' ▲' : ' ▼') : ' ↕';
  const opacity = isActive ? '1' : '0.4';
  const color = isActive ? 'color: var(--accent);' : '';
  const align = alignClass ? `class="${alignClass}"` : '';
  return `<th ${align} style="cursor: pointer; user-select: none; ${color}" onclick="${fnName}('${key}')" title="Click to sort all records by ${title}">
    ${title} <span class="sort-indicator" style="font-size: 10px; margin-left: 3px; opacity: ${opacity};">${arrow}</span>
  </th>`;
}

function makeTableSortable(tableEl) {
  if (!tableEl || tableEl.dataset.sortableAttached === 'true' || tableEl.dataset.fullDatasetSort === 'true') return;
  tableEl.dataset.sortableAttached = 'true';

  const headers = tableEl.querySelectorAll('thead th');
  let currentSortCol = -1;
  let isAscending = true;

  headers.forEach((th, idx) => {
    th.style.cursor = 'pointer';
    th.title = 'Click to sort table by ' + th.textContent.trim();

    // Append initial sort indicator icon
    const indicator = document.createElement('span');
    indicator.className = 'sort-indicator';
    indicator.style.fontSize = '10px';
    indicator.style.marginLeft = '5px';
    indicator.style.opacity = '0.5';
    indicator.textContent = ' ↕';
    th.appendChild(indicator);

    th.addEventListener('click', () => {
      const tbody = tableEl.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.querySelectorAll('tr')).filter(r => !r.classList.contains('total-row'));
      const totalRows = Array.from(tbody.querySelectorAll('tr.total-row'));

      if (currentSortCol === idx) {
        isAscending = !isAscending;
      } else {
        currentSortCol = idx;
        isAscending = true;
      }

      // Reset all indicators
      headers.forEach(h => {
        const ind = h.querySelector('.sort-indicator');
        if (ind) {
          ind.textContent = ' ↕';
          ind.style.opacity = '0.5';
        }
      });

      // Highlight active sort header indicator
      const activeInd = th.querySelector('.sort-indicator');
      if (activeInd) {
        activeInd.textContent = isAscending ? ' ▲' : ' ▼';
        activeInd.style.opacity = '1';
      }

      rows.sort((rowA, rowB) => {
        const cellA = rowA.children[idx] ? rowA.children[idx].textContent.trim() : '';
        const cellB = rowB.children[idx] ? rowB.children[idx].textContent.trim() : '';

        // Check if sorting by Est Code or Est Name
        const headerTxt = headers[idx] ? headers[idx].textContent.trim().toLowerCase() : '';
        const isEstSort = headerTxt.includes('code') || headerTxt.includes('name') || headerTxt.includes('est');

        // Try numeric parsing (strip currency symbols ₹, %, commas, hashes #)
        const cleanA = cellA.replace(/[₹,%\s#]/g, '');
        const cleanB = cellB.replace(/[₹,%\s#]/g, '');
        const numA = parseFloat(cleanA);
        const numB = parseFloat(cleanB);

        let primaryCompare = 0;
        if (!isNaN(numA) && !isNaN(numB) && !cellA.match(/[a-zA-Z]/) && !cellB.match(/[a-zA-Z]/)) {
          primaryCompare = isAscending ? numA - numB : numB - numA;
        } else {
          primaryCompare = isAscending
            ? cellA.localeCompare(cellB, undefined, { numeric: true, sensitivity: 'base' })
            : cellB.localeCompare(cellA, undefined, { numeric: true, sensitivity: 'base' });
        }

        // Statutory Legal Hierarchy Ordering (7A -> 7Q(7A) -> 14B -> 7Q(14B)) when Est Code / Name match
        if (primaryCompare === 0 || isEstSort) {
          const estA = rowA.children[1] ? rowA.children[1].textContent.trim() : '';
          const estB = rowB.children[1] ? rowB.children[1].textContent.trim() : '';

          if (estA === estB || primaryCompare === 0) {
            const typeA = rowA.querySelector('.type-badge') ? rowA.querySelector('.type-badge').textContent.trim() : '';
            const typeB = rowB.querySelector('.type-badge') ? rowB.querySelector('.type-badge').textContent.trim() : '';

            const rankA = getCertificateLegalWeight(typeA);
            const rankB = getCertificateLegalWeight(typeB);

            if (rankA !== rankB) {
              return isAscending ? rankA - rankB : rankB - rankA;
            }
          }
        }

        return primaryCompare;
      });

      tbody.innerHTML = '';
      const firstHeader = headers[0] ? headers[0].textContent.trim().toLowerCase() : '';
      const hasSlCol = firstHeader.includes('sl') || firstHeader.includes('rank') || firstHeader.includes('#');

      rows.forEach((r, idx) => {
        if (hasSlCol && r.children[0]) {
          r.children[0].innerHTML = `<strong>#${idx + 1}</strong>`;
        }
        tbody.appendChild(r);
      });
      totalRows.forEach(r => tbody.appendChild(r));
    });
  });
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function saveState() {
  const state = {
    mode: appData.currentMode,
    filter: document.getElementById('filterEntry').value,
    dropdownVal: document.getElementById('searchDropdown').value,
    selectBoxVal: document.getElementById('matchedRecordsBox').value
  };
  localStorage.setItem('rrc_manager_web_state', JSON.stringify(state));
}

function restoreState() {
  try {
    const raw = localStorage.getItem('rrc_manager_web_state');
    if (!raw) return;
    const state = JSON.parse(raw);

    if (state.mode) setSearchMode(state.mode);
    if (state.filter) {
      document.getElementById('filterEntry').value = state.filter;
      filterOptions();
    }
    if (state.dropdownVal && state.dropdownVal !== '') {
      document.getElementById('searchDropdown').value = state.dropdownVal;
      onRecordSelect(state.dropdownVal);
    }
  } catch (e) {
    console.error('Error restoring state:', e);
  }
}

// ------------------------------------------------------------------
// 7 RRC ANALYTICS DASHBOARD CARDS & OPERATIONAL INTELLIGENCE REPORTS
// ------------------------------------------------------------------
function renderSevenAnalyticsCards() {
  renderCardDefaulters();
  renderCardDistrict();
  renderCardRo();
  renderCardAgeing();
  renderCardAction();
  renderCardMode();
  renderCardAccountSplit();
}

// ------------------------------------------------------------------
// Quick 1-Click Targeted Certificate Ledger Launcher Popup
// ------------------------------------------------------------------
function quickOpenEstablishment(estCode, targetRrcId = null, targetType = null) {
  if (!estCode) return;

  let matched = appData.master.filter(r => cleanStr(r.est_code) === estCode);
  if (matched.length === 0) matched = appData.master.filter(r => cleanStr(r.rrc_no) === estCode);
  if (matched.length === 0) matched = appData.master.filter(r => cleanStr(r.est_name) === estCode);

  if (matched.length === 0) return alert('Establishment record not found for ' + estCode);

  const primary = matched[0];
  const name = cleanStr(primary.est_name) || 'Unknown Establishment';
  const code = cleanStr(primary.est_code);
  const recOfficer = cleanStr(primary.recovery_officer) || 'N/A';
  const enfOfficer = cleanStr(primary.enforcement_officer) || 'N/A';
  const dist = cleanStr(primary.district) || 'N/A';

  const titleEl = document.getElementById('quickEstModalTitle');
  const subEl = document.getElementById('quickEstModalSubtitle');
  if (titleEl) titleEl.textContent = name;
  if (subEl) subEl.textContent = `EST CODE: ${code}   •   DISTRICT: ${dist}   •   CERTIFICATES: ${matched.length}`;

  const container = document.getElementById('quickEstLedgerModalBody');
  if (!container) return;

  // Build Filter Tabs if multiple certificates exist
  let filterButtonsHtml = '';
  if (matched.length > 1) {
    filterButtonsHtml = `
      <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--border-color);">
        <span style="font-size: 11px; font-weight: 700; color: var(--text-secondary); margin-right: 4px;">CERTIFICATE FILTER:</span>
        <button class="search-mode-btn ${!targetType && !targetRrcId ? 'active' : ''}" style="width: auto; padding: 4px 12px; font-size: 11px;" onclick="renderQuickEstCards('${code}', null, null)">
          Show All (${matched.length})
        </button>
    `;
    matched.forEach(r => {
      const typeStr = cleanStr(r.type);
      const rrcStr = cleanStr(r.rrc_no);
      const isAct = (targetRrcId && r.id === targetRrcId) || (targetType && typeStr === targetType && !targetRrcId);
      filterButtonsHtml += `
        <button class="search-mode-btn ${isAct ? 'active' : ''}" style="width: auto; padding: 4px 12px; font-size: 11px;" onclick="renderQuickEstCards('${code}', ${r.id}, '${typeStr}')">
          <span class="type-badge" style="font-size: 9px; padding: 2px 6px;">${typeStr}</span> ${rrcStr}
        </button>
      `;
    });
    filterButtonsHtml += `</div>`;
  }

  container.innerHTML = `
    <div class="establishment-header-card" style="margin-bottom: 20px;">
      <h2 class="est-title" style="margin: 0 0 6px 0;">${name}</h2>
      <p class="est-subtitle" style="margin: 0 0 10px 0;">EST CODE: <code>${code}</code> &nbsp;•&nbsp; DISTRICT: ${dist} &nbsp;•&nbsp; TOTAL CERTIFICATES: ${matched.length}</p>
      <div class="officers-badge-group">
        <i class="fas fa-user-shield me-1"></i> Recovery Officer: <strong>${recOfficer}</strong> &nbsp;•&nbsp; Enforcement Officer: <strong>${enfOfficer}</strong>
      </div>
      ${filterButtonsHtml}
    </div>
    <div id="quickCardsContainer"></div>
  `;

  renderQuickEstCards(code, targetRrcId, targetType);
  openModal('quickEstLedgerModal');
}

function renderQuickEstCards(estCode, targetRrcId, targetType) {
  const cardsContainer = document.getElementById('quickCardsContainer');
  if (!cardsContainer) return;
  cardsContainer.innerHTML = '';

  let matched = appData.master.filter(r => cleanStr(r.est_code) === estCode || cleanStr(r.rrc_no) === estCode || cleanStr(r.est_name) === estCode);

  let filtered = matched;
  if (targetRrcId) {
    filtered = matched.filter(r => r.id === targetRrcId);
  } else if (targetType) {
    filtered = matched.filter(r => cleanStr(r.type) === targetType);
  }

  if (filtered.length === 0) filtered = matched;

  // Sort cards by Statutory Legal Hierarchy: 7A -> 7Q(for 7A) -> 14B -> 7Q(for 14B)
  filtered.sort((a, b) => {
    const typeA = cleanStr(a.type).toUpperCase();
    const typeB = cleanStr(b.type).toUpperCase();
    const rrcA = cleanStr(a.rrc_no).toUpperCase();
    const rrcB = cleanStr(b.rrc_no).toUpperCase();

    if (rrcA === rrcB && typeA !== typeB) {
      if (typeA === '7A') return -1;
      if (typeB === '7A') return 1;
      if (typeA === '14B' && typeB === '7Q') return -1;
      if (typeB === '14B' && typeA === '7Q') return 1;
    }

    const weightA = getCertificateLegalWeight(typeA);
    const weightB = getCertificateLegalWeight(typeB);
    if (weightA !== weightB) return weightA - weightB;
    return rrcA.localeCompare(rrcB);
  });

  filtered.forEach(row => {
    const cardEl = buildCertificateCard(row);
    cardsContainer.appendChild(cardEl);
  });
}

// 1. TOP DEFAULTERS WATCHLIST CARD
function renderCardDefaulters() {
  const el = document.getElementById('defaultersPreviewList');
  if (!el) return;

  const sorted = [...appData.master].sort((a, b) => (parseFloat(b.pending_curr_year) || parseFloat(b.recovery_ob) || 0) - (parseFloat(a.pending_curr_year) || parseFloat(a.recovery_ob) || 0));
  const top3 = sorted.slice(0, 3);

  let html = '';
  top3.forEach((r, idx) => {
    const name = cleanStr(r.est_name) || 'Unknown Establishment';
    const code = cleanStr(r.est_code);
    const typeStr = cleanStr(r.type);
    const pend = parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0;
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding: 4px; border-radius: 6px; cursor: pointer;" onclick="quickOpenEstablishment('${code}', ${r.id}, '${typeStr}')" title="Click to open ${typeStr} ledger">
        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">
          <strong style="color: var(--accent);">#${idx + 1} ${name}</strong> <span class="type-badge" style="font-size:9px; padding:1px 5px;">${typeStr}</span><br>
          <span style="font-size:10px; color:var(--text-secondary);">${code}</span>
        </div>
        <strong style="color:var(--danger); font-size:11px;">${fmtCur(pend)}</strong>
      </div>
    `;
  });
  el.innerHTML = html;
}

let _defaultersRecords = [];
let _defaultersSortKey = 'pending';
let _defaultersSortAsc = false;

function _sortDefaultersDataset() {
  _defaultersRecords.sort((a, b) => {
    let valA, valB;
    if (_defaultersSortKey === 'pending') {
      valA = parseFloat(a.pending_curr_year) || parseFloat(a.recovery_ob) || 0;
      valB = parseFloat(b.pending_curr_year) || parseFloat(b.recovery_ob) || 0;
    } else if (_defaultersSortKey === 'total_dues') {
      valA = parseFloat(a.recovery_ob) || 0;
      valB = parseFloat(b.recovery_ob) || 0;
    } else if (_defaultersSortKey === 'est_name') {
      valA = cleanStr(a.est_name);
      valB = cleanStr(b.est_name);
    } else if (_defaultersSortKey === 'est_code') {
      valA = cleanStr(a.est_code);
      valB = cleanStr(b.est_code);
    } else if (_defaultersSortKey === 'type') {
      valA = cleanStr(a.type);
      valB = cleanStr(b.type);
    } else if (_defaultersSortKey === 'rrc_no') {
      valA = cleanStr(a.rrc_no);
      valB = cleanStr(b.rrc_no);
    } else if (_defaultersSortKey === 'period') {
      valA = cleanStr(a.period);
      valB = cleanStr(b.period);
    } else if (_defaultersSortKey === 'district') {
      valA = cleanStr(a.district);
      valB = cleanStr(b.district);
    } else {
      valA = cleanStr(a.est_name);
      valB = cleanStr(b.est_name);
    }

    let comp = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comp = valA - valB;
    } else {
      comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
    }

    if (comp !== 0) {
      return _defaultersSortAsc ? comp : -comp;
    }
    const nameComp = cleanStr(a.est_name).localeCompare(cleanStr(b.est_name));
    if (nameComp !== 0) return nameComp;
    return getCertificateLegalWeight(a.type) - getCertificateLegalWeight(b.type);
  });
}

function sortDefaultersBy(key) {
  if (_defaultersSortKey === key) {
    _defaultersSortAsc = !_defaultersSortAsc;
  } else {
    _defaultersSortKey = key;
    _defaultersSortAsc = (key === 'pending' || key === 'total_dues') ? false : true;
  }
  _sortDefaultersDataset();
  renderDefaultersPage(1);
}

function showDefaultersModal() {
  _defaultersRecords = [...appData.master];
  _defaultersSortKey = 'pending';
  _defaultersSortAsc = false;
  _sortDefaultersDataset();
  renderDefaultersPage(1);
  openModal('defaultersModal');
}

function renderDefaultersPage(page) {
  const records = _defaultersRecords;
  const total = records.length;
  const start = (page - 1) * RRC_PAGE_SIZE;
  const pageRecs = records.slice(start, start + RRC_PAGE_SIZE);

  let html = `<div class="table-responsive"><table class="ledger-table" id="defaultersTable" data-full-dataset-sort="true"><thead><tr>
    <th>Sl. No.</th>
    ${makeSortableTh('EST Code', 'est_code', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy')}
    ${makeSortableTh('Establishment Name', 'est_name', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy')}
    ${makeSortableTh('Type', 'type', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy')}
    ${makeSortableTh('RRC No', 'rrc_no', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy')}
    ${makeSortableTh('Period', 'period', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy')}
    ${makeSortableTh('District', 'district', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy')}
    ${makeSortableTh('Total Dues OB (₹)', 'total_dues', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy', 'text-end')}
    ${makeSortableTh('Pending Amount (₹)', 'pending', _defaultersSortKey, _defaultersSortAsc, 'sortDefaultersBy', 'text-end')}
    <th class="text-center">Action</th>
  </tr></thead><tbody>`;

  pageRecs.forEach((r, i) => {
    const ob = parseFloat(r.recovery_ob) || 0;
    const pend = parseFloat(r.pending_curr_year) || ob;
    const code = cleanStr(r.est_code);
    const typeStr = cleanStr(r.type);
    const rrcNo = cleanStr(r.rrc_no);
    const globalIdx = start + i;
    html += `
      <tr style="cursor:pointer;" onclick="quickOpenEstablishment('${code}',${r.id},'${typeStr}')" title="Click to open ${typeStr} (${rrcNo}) ledger">
        <td><strong>#${globalIdx + 1}</strong></td>
        <td><code style="color:var(--accent);font-weight:700;">${code}</code></td>
        <td class="est-name-cell"><strong style="color:var(--text-primary);">${cleanStr(r.est_name)}</strong> <i class="fas fa-external-link-alt ms-1" style="font-size:10px;color:var(--accent);opacity:0.8;"></i></td>
        <td><span class="type-badge" onclick="event.stopPropagation(); quickOpenEstablishment('${code}',${r.id},'${typeStr}')" style="cursor:pointer;">${typeStr}</span></td>
        <td>${rrcNo}</td>
        <td style="font-size:11px;color:var(--text-secondary);">${cleanStr(r.period) || '-'}</td>
        <td>${cleanStr(r.district) || 'N/A'}</td>
        <td class="text-end">${fmtCur(ob)}</td>
        <td class="text-end val-pending">${fmtCur(pend)}</td>
        <td class="text-center">
          <button class="sidebar-btn btn-success" style="width:auto;margin:0;padding:4px 10px;font-size:10px;border-radius:6px;" onclick="event.stopPropagation(); quickOpenEstablishment('${code}',${r.id},'${typeStr}')">
            <i class="fas fa-plus-circle me-1"></i> Open ${typeStr}
          </button>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById('defaultersModalBody').innerHTML = html;
  document.getElementById('defaultersPagination').innerHTML = makePaginationBar(total, page, 'renderDefaultersPage');
}

function exportDefaultersCsv() {
  const labelMap = { pending: 'Pending Amount', total_dues: 'Total Dues OB', est_name: 'Establishment Name', est_code: 'EST Code', type: 'Type', rrc_no: 'RRC No', period: 'Period', district: 'District' };
  const sortLabel = labelMap[_defaultersSortKey] || _defaultersSortKey;
  let csv = `Top Defaulters Watchlist — Sorted by ${sortLabel} (${_defaultersSortAsc ? 'Ascending' : 'Descending'})\n`;
  csv += 'Rank,EST Code,EST Name,Type,RRC No,Period,District,Total Dues OB,Pending Amount\n';
  _defaultersRecords.forEach((r, idx) => {
    csv += `${idx + 1},"${cleanStr(r.est_code)}","${cleanStr(r.est_name)}","${cleanStr(r.type)}","${cleanStr(r.rrc_no)}","${cleanStr(r.period) || ''}","${cleanStr(r.district)}",${r.recovery_ob || 0},${r.pending_curr_year || 0}\n`;
  });
  downloadCsvFile(csv, 'Top_Defaulters_Watchlist.csv');
}

// 2. DISTRICT BREAKDOWN CARD
function renderCardDistrict() {
  const el = document.getElementById('districtPreviewList');
  if (!el) return;

  let distMap = {};
  appData.master.forEach(r => {
    const d = cleanStr(r.district) || 'OTHER / UNKNOWN';
    if (!distMap[d]) distMap[d] = { count: 0, pending: 0 };
    distMap[d].count++;
    distMap[d].pending += parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0;
  });

  const sorted = Object.keys(distMap).sort((a, b) => distMap[b].pending - distMap[a].pending);
  let html = '';
  sorted.slice(0, 3).forEach(d => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div><strong>${d}</strong> <span style="font-size:10px; color:var(--text-secondary);">(${distMap[d].count} RRCs)</span></div>
        <strong style="color:var(--text-primary); font-size:11px;">${fmtCur(distMap[d].pending)}</strong>
      </div>
    `;
  });
  el.innerHTML = html;
}

function showDistrictModal() {
  const el = document.getElementById('districtModalBody');
  let distMap = {};
  appData.master.forEach(r => {
    const d = cleanStr(r.district) || 'OTHER / UNKNOWN';
    if (!distMap[d]) distMap[d] = { count: 0, ob: 0, paid: 0, pending: 0 };
    distMap[d].count++;
    distMap[d].ob += parseFloat(r.recovery_ob) || 0;
    distMap[d].paid += parseFloat(r.recovered_curr_year) || 0;
    distMap[d].pending += parseFloat(r.pending_curr_year) || 0;
  });

  const sorted = Object.keys(distMap).sort((a, b) => distMap[b].pending - distMap[a].pending);
  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>District</th>
            <th class="text-center">Total RRCs</th>
            <th class="text-end">Total Dues OB (₹)</th>
            <th class="text-end">Recovered Amount (₹)</th>
            <th class="text-end">Pending Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totRrc = 0, totOb = 0, totPaid = 0, totPend = 0;
  sorted.forEach(d => {
    const m = distMap[d];
    totRrc += m.count; totOb += m.ob; totPaid += m.paid; totPend += m.pending;
    html += `
      <tr>
        <td><strong>${d}</strong></td>
        <td class="text-center">${m.count}</td>
        <td class="text-end">${fmtCur(m.ob)}</td>
        <td class="text-end val-cleared">${fmtCur(m.paid)}</td>
        <td class="text-end val-pending">${fmtCur(m.pending)}</td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row">
          <td>GRAND TOTAL</td>
          <td class="text-center">${totRrc}</td>
          <td class="text-end">${fmtCur(totOb)}</td>
          <td class="text-end val-cleared">${fmtCur(totPaid)}</td>
          <td class="text-end val-pending">${fmtCur(totPend)}</td>
        </tr>
      </tbody></table></div>
  `;
  el.innerHTML = html;
  openModal('districtModal');
}

function exportDistrictCsv() {
  let distMap = {};
  appData.master.forEach(r => {
    const d = cleanStr(r.district) || 'OTHER / UNKNOWN';
    if (!distMap[d]) distMap[d] = { count: 0, ob: 0, paid: 0, pending: 0 };
    distMap[d].count++;
    distMap[d].ob += parseFloat(r.recovery_ob) || 0;
    distMap[d].paid += parseFloat(r.recovered_curr_year) || 0;
    distMap[d].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let csv = 'District,Total RRCs,Total Dues OB,Recovered Amount,Pending Amount\n';
  Object.keys(distMap).sort().forEach(d => {
    const m = distMap[d];
    csv += `"${d}",${m.count},${m.ob},${m.paid},${m.pending}\n`;
  });
  downloadCsvFile(csv, 'District_Recovery_Report.csv');
}

// 3. RECOVERY OFFICERS (RO) CARD
function renderCardRo() {
  const el = document.getElementById('roPreviewList');
  if (!el) return;

  let roMap = {};
  appData.master.forEach(r => {
    const ro = cleanStr(r.recovery_officer) || 'UNASSIGNED RO';
    if (!roMap[ro]) roMap[ro] = { count: 0, pending: 0 };
    roMap[ro].count++;
    roMap[ro].pending += parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0;
  });

  const sorted = Object.keys(roMap).sort((a, b) => roMap[b].pending - roMap[a].pending);
  let html = '';
  sorted.slice(0, 3).forEach(ro => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">
          <strong>${ro}</strong><br><span style="font-size:10px; color:var(--text-secondary);">${roMap[ro].count} Certificates</span>
        </div>
        <strong style="color:var(--text-primary); font-size:11px;">${fmtCur(roMap[ro].pending)}</strong>
      </div>
    `;
  });
  el.innerHTML = html;
}

function showRoModal() {
  const el = document.getElementById('roModalBody');
  let roMap = {};
  appData.master.forEach(r => {
    const ro = cleanStr(r.recovery_officer) || 'UNASSIGNED RO';
    if (!roMap[ro]) roMap[ro] = { count: 0, ob: 0, paid: 0, pending: 0 };
    roMap[ro].count++;
    roMap[ro].ob += parseFloat(r.recovery_ob) || 0;
    roMap[ro].paid += parseFloat(r.recovered_curr_year) || 0;
    roMap[ro].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Recovery Officer (RO)</th>
            <th class="text-center">Assigned RRCs</th>
            <th class="text-end">Total Dues OB (₹)</th>
            <th class="text-end">Recovered Amount (₹)</th>
            <th class="text-end">Pending Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totRrc = 0, totOb = 0, totPaid = 0, totPend = 0;
  Object.keys(roMap).sort().forEach(ro => {
    const m = roMap[ro];
    totRrc += m.count; totOb += m.ob; totPaid += m.paid; totPend += m.pending;
    html += `
      <tr>
        <td><strong>${ro}</strong></td>
        <td class="text-center">${m.count}</td>
        <td class="text-end">${fmtCur(m.ob)}</td>
        <td class="text-end val-cleared">${fmtCur(m.paid)}</td>
        <td class="text-end val-pending">${fmtCur(m.pending)}</td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row">
          <td>GRAND TOTAL</td>
          <td class="text-center">${totRrc}</td>
          <td class="text-end">${fmtCur(totOb)}</td>
          <td class="text-end val-cleared">${fmtCur(totPaid)}</td>
          <td class="text-end val-pending">${fmtCur(totPend)}</td>
        </tr>
      </tbody></table></div>
  `;
  el.innerHTML = html;
  openModal('roModal');
}

function exportRoCsv() {
  let roMap = {};
  appData.master.forEach(r => {
    const ro = cleanStr(r.recovery_officer) || 'UNASSIGNED RO';
    if (!roMap[ro]) roMap[ro] = { count: 0, ob: 0, paid: 0, pending: 0 };
    roMap[ro].count++;
    roMap[ro].ob += parseFloat(r.recovery_ob) || 0;
    roMap[ro].paid += parseFloat(r.recovered_curr_year) || 0;
    roMap[ro].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let csv = 'Recovery Officer,Assigned RRCs,Total Dues OB,Recovered Amount,Pending Amount\n';
  Object.keys(roMap).sort().forEach(ro => {
    const m = roMap[ro];
    csv += `"${ro}",${m.count},${m.ob},${m.paid},${m.pending}\n`;
  });
  downloadCsvFile(csv, 'Recovery_Officer_Performance.csv');
}

// 4. AGEING & VINTAGE CARD
function renderCardAgeing() {
  const el = document.getElementById('ageingPreviewList');
  if (!el) return;

  const buckets = calculateAgeingBuckets();
  let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>&lt; 1 Year (Fresh):</span> <strong>${fmtCur(buckets['< 1 Year'])}</strong></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>1–3 Years:</span> <strong>${fmtCur(buckets['1-3 Years'])}</strong></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>3–5 Years:</span> <strong>${fmtCur(buckets['3-5 Years'])}</strong></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span style="color:var(--danger); font-weight:600;">5+ Years (Legacy):</span> <strong style="color:var(--danger);">${fmtCur(buckets['5+ Years'])}</strong></div>
  `;
  el.innerHTML = html;
}

function calculateAgeingBuckets() {
  const currYear = new Date().getFullYear();
  let buckets = { '< 1 Year': 0, '1-3 Years': 0, '3-5 Years': 0, '5+ Years': 0 };

  appData.master.forEach(r => {
    const yr = parseInt(cleanStr(r.issued_year), 10) || currYear;
    const diff = currYear - yr;
    const pend = parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0;

    if (diff <= 1) buckets['< 1 Year'] += pend;
    else if (diff <= 3) buckets['1-3 Years'] += pend;
    else if (diff <= 5) buckets['3-5 Years'] += pend;
    else buckets['5+ Years'] += pend;
  });

  return buckets;
}

function showAgeingModal() {
  const el = document.getElementById('ageingModalBody');
  const currYear = new Date().getFullYear();
  let yearMap = {};

  appData.master.forEach(r => {
    const yr = cleanStr(r.issued_year) || 'Unknown';
    if (!yearMap[yr]) yearMap[yr] = { count: 0, ob: 0, paid: 0, pending: 0 };
    yearMap[yr].count++;
    yearMap[yr].ob += parseFloat(r.recovery_ob) || 0;
    yearMap[yr].paid += parseFloat(r.recovered_curr_year) || 0;
    yearMap[yr].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Issued Year</th>
            <th class="text-center">Certificates</th>
            <th class="text-end">Total Dues OB (₹)</th>
            <th class="text-end">Recovered Amount (₹)</th>
            <th class="text-end">Pending Balance (₹)</th>
            <th class="text-center">View RRCs</th>
          </tr>
        </thead>
        <tbody>
  `;

  Object.keys(yearMap).sort().reverse().forEach(yr => {
    const m = yearMap[yr];
    const age = yr !== 'Unknown' ? (currYear - parseInt(yr, 10)) : '?';
    const ageBadge = yr === 'Unknown' ? '' :
      age <= 1 ? `<span style="background:rgba(0,184,148,0.15);color:var(--success);border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px;">Fresh</span>` :
      age <= 3 ? `<span style="background:rgba(108,92,231,0.15);color:var(--accent);border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px;">1–3 Yrs</span>` :
      age <= 5 ? `<span style="background:rgba(247,183,51,0.15);color:var(--warning);border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px;">3–5 Yrs</span>` :
      `<span style="background:rgba(255,71,87,0.15);color:var(--danger);border-radius:12px;padding:2px 8px;font-size:11px;font-weight:700;margin-left:8px;">Legacy 5+</span>`;

    html += `
      <tr>
        <td><strong>Year ${yr}</strong>${ageBadge}</td>
        <td class="text-center">
          <a href="javascript:void(0)" onclick="showAgeingYearDrilldown('${yr}')"
             style="color:var(--accent);font-weight:700;font-size:15px;text-decoration:underline;cursor:pointer;"
             title="Click to view all ${m.count} RRC certificates issued in ${yr}">
            ${m.count} certificates
          </a>
        </td>
        <td class="text-end">${fmtCur(m.ob)}</td>
        <td class="text-end val-cleared">${fmtCur(m.paid)}</td>
        <td class="text-end val-pending">${fmtCur(m.pending)}</td>
        <td class="text-center">
          <button class="sidebar-btn btn-outline" style="width:auto;margin:0;padding:4px 12px;font-size:12px;"
            onclick="showAgeingYearDrilldown('${yr}')">
            <i class="fas fa-list me-1"></i> View ${m.count} RRCs
          </button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
  openModal('ageingModal');
}

// Module-level variable for ageing year drill-down exports
let _currentAgeingYear = '';
let _ageingDrilldownRecords = [];
let _ageingDrilldownSortKey = 'pending';
let _ageingDrilldownSortAsc = false;

function _sortAgeingDrilldownDataset() {
  _ageingDrilldownRecords.sort((a, b) => {
    let valA, valB;
    if (_ageingDrilldownSortKey === 'pending') {
      valA = parseFloat(a.pending_curr_year) || parseFloat(a.recovery_ob) || 0;
      valB = parseFloat(b.pending_curr_year) || parseFloat(b.recovery_ob) || 0;
    } else if (_ageingDrilldownSortKey === 'recovered') {
      valA = parseFloat(a.recovered_curr_year) || 0;
      valB = parseFloat(b.recovered_curr_year) || 0;
    } else if (_ageingDrilldownSortKey === 'total_dues') {
      valA = parseFloat(a.recovery_ob) || 0;
      valB = parseFloat(b.recovery_ob) || 0;
    } else if (_ageingDrilldownSortKey === 'est_name') {
      valA = cleanStr(a.est_name);
      valB = cleanStr(b.est_name);
    } else if (_ageingDrilldownSortKey === 'est_code') {
      valA = cleanStr(a.est_code);
      valB = cleanStr(b.est_code);
    } else if (_ageingDrilldownSortKey === 'type') {
      valA = cleanStr(a.type);
      valB = cleanStr(b.type);
    } else if (_ageingDrilldownSortKey === 'rrc_no') {
      valA = cleanStr(a.rrc_no);
      valB = cleanStr(b.rrc_no);
    } else if (_ageingDrilldownSortKey === 'period') {
      valA = cleanStr(a.period);
      valB = cleanStr(b.period);
    } else if (_ageingDrilldownSortKey === 'district') {
      valA = cleanStr(a.district);
      valB = cleanStr(b.district);
    } else if (_ageingDrilldownSortKey === 'eo') {
      valA = cleanStr(a.enforcement_officer);
      valB = cleanStr(b.enforcement_officer);
    } else {
      valA = cleanStr(a.est_name);
      valB = cleanStr(b.est_name);
    }

    let comp = 0;
    if (typeof valA === 'number' && typeof valB === 'number') {
      comp = valA - valB;
    } else {
      comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
    }

    if (comp !== 0) {
      return _ageingDrilldownSortAsc ? comp : -comp;
    }
    const nameComp = cleanStr(a.est_name).localeCompare(cleanStr(b.est_name));
    if (nameComp !== 0) return nameComp;
    return getCertificateLegalWeight(a.type) - getCertificateLegalWeight(b.type);
  });
}

function sortAgeingDrilldownBy(key) {
  if (_ageingDrilldownSortKey === key) {
    _ageingDrilldownSortAsc = !_ageingDrilldownSortAsc;
  } else {
    _ageingDrilldownSortKey = key;
    _ageingDrilldownSortAsc = (key === 'pending' || key === 'total_dues' || key === 'recovered') ? false : true;
  }
  _sortAgeingDrilldownDataset();
  renderAgeingDrilldownPage(1);
}

function showAgeingYearDrilldown(year) {
  _currentAgeingYear = year;
  _ageingDrilldownRecords = appData.master
    .filter(r => (cleanStr(r.issued_year) || 'Unknown') === year);

  if (_ageingDrilldownRecords.length === 0) return alert('No certificates found for year ' + year);

  _ageingDrilldownSortKey = 'pending';
  _ageingDrilldownSortAsc = false;
  _sortAgeingDrilldownDataset();

  const currYear = new Date().getFullYear();
  const age = year !== 'Unknown' ? (currYear - parseInt(year, 10)) : '?';
  const titleEl = document.getElementById('ageingDrilldownTitle');
  const subEl = document.getElementById('ageingDrilldownSubtitle');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-hourglass-half me-2" style="color:var(--warning);"></i> RRC Certificates — Issued Year ${year}`;
  if (subEl) subEl.textContent = `${_ageingDrilldownRecords.length} certificate${_ageingDrilldownRecords.length !== 1 ? 's' : ''} issued in ${year} (${age} year${age !== 1 ? 's' : ''} old) · sorted by pending amount`;

  renderAgeingDrilldownPage(1);
  openModal('ageingDrilldownModal');
}

function renderAgeingDrilldownPage(page) {
  const records = _ageingDrilldownRecords;
  const total = records.length;
  const start = (page - 1) * RRC_PAGE_SIZE;
  const pageRecs = records.slice(start, start + RRC_PAGE_SIZE);

  let html = `<div class="table-responsive"><table class="ledger-table" id="ageingDrilldownTable" data-full-dataset-sort="true"><thead><tr>
    <th>Sl. No.</th>
    ${makeSortableTh('EST Code', 'est_code', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('Establishment Name', 'est_name', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('Type', 'type', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('RRC No', 'rrc_no', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('Period', 'period', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('District', 'district', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('Enforcement Officer', 'eo', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy')}
    ${makeSortableTh('Total Dues OB (₹)', 'total_dues', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy', 'text-end')}
    ${makeSortableTh('Recovered (₹)', 'recovered', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy', 'text-end')}
    ${makeSortableTh('Pending Amount (₹)', 'pending', _ageingDrilldownSortKey, _ageingDrilldownSortAsc, 'sortAgeingDrilldownBy', 'text-end')}
    <th class="text-center">Action</th>
  </tr></thead><tbody>`;

  pageRecs.forEach((r, i) => {
    const ob = parseFloat(r.recovery_ob) || 0;
    const paid = parseFloat(r.recovered_curr_year) || 0;
    const pend = parseFloat(r.pending_curr_year) || ob;
    const code = cleanStr(r.est_code);
    const typeStr = cleanStr(r.type);
    const rrcNo = cleanStr(r.rrc_no);
    const eo = cleanStr(r.enforcement_officer) || 'Unassigned';
    const globalIdx = start + i;
    html += `
      <tr style="cursor:pointer;" onclick="closeModal('ageingDrilldownModal'); quickOpenEstablishment('${code}',${r.id},'${typeStr}')" title="Open ${typeStr} ledger">
        <td><strong>#${globalIdx + 1}</strong></td>
        <td><code style="color:var(--accent);font-weight:700;">${code}</code></td>
        <td class="est-name-cell"><strong style="color:var(--text-primary);">${cleanStr(r.est_name)}</strong> <i class="fas fa-external-link-alt ms-1" style="font-size:10px;color:var(--accent);opacity:0.8;"></i></td>
        <td><span class="type-badge" onclick="event.stopPropagation(); closeModal('ageingDrilldownModal'); quickOpenEstablishment('${code}',${r.id},'${typeStr}')" style="cursor:pointer;">${typeStr}</span></td>
        <td>${rrcNo}</td>
        <td style="font-size:11px;color:var(--text-secondary);">${cleanStr(r.period) || '-'}</td>
        <td>${cleanStr(r.district) || 'N/A'}</td>
        <td style="font-size:13px;">${eo}</td>
        <td class="text-end">${fmtCur(ob)}</td>
        <td class="text-end val-cleared">${fmtCur(paid)}</td>
        <td class="text-end val-pending">${fmtCur(pend)}</td>
        <td class="text-center">
          <button class="sidebar-btn btn-success" style="width:auto;margin:0;padding:4px 10px;font-size:10px;border-radius:6px;" onclick="event.stopPropagation(); closeModal('ageingDrilldownModal'); quickOpenEstablishment('${code}',${r.id},'${typeStr}')">
            <i class="fas fa-plus-circle me-1"></i> Open ${typeStr}
          </button>
        </td>
      </tr>`;
  });

  html += `</tbody></table></div>`;
  document.getElementById('ageingDrilldownBody').innerHTML = html;
  document.getElementById('ageingDrilldownPagination').innerHTML = makePaginationBar(total, page, 'renderAgeingDrilldownPage');
}

function exportAgeingYearCsv() {
  const labelMap = { pending: 'Pending Amount', total_dues: 'Total Dues OB', recovered: 'Recovered', est_name: 'Establishment Name', est_code: 'EST Code', type: 'Type', rrc_no: 'RRC No', period: 'Period', district: 'District', eo: 'Enforcement Officer' };
  const sortLabel = labelMap[_ageingDrilldownSortKey] || _ageingDrilldownSortKey;
  let csv = `Issued Year: ${_currentAgeingYear} — Sorted by ${sortLabel} (${_ageingDrilldownSortAsc ? 'Ascending' : 'Descending'})\nRank,EST Code,EST Name,Type,RRC No,Period,District,Enforcement Officer,Total Dues OB,Recovered,Pending Amount\n`;
  _ageingDrilldownRecords.forEach((r, idx) => {
    csv += `${idx + 1},"${cleanStr(r.est_code)}","${cleanStr(r.est_name)}","${cleanStr(r.type)}","${cleanStr(r.rrc_no)}","${cleanStr(r.period) || ''}","${cleanStr(r.district)}","${cleanStr(r.enforcement_officer) || 'Unassigned'}",${r.recovery_ob || 0},${r.recovered_curr_year || 0},${r.pending_curr_year || 0}\n`;
  });
  downloadCsvFile(csv, `RRC_Year_${_currentAgeingYear}.csv`);
}

function exportAgeingYearPdf() {
  const labelMap = { pending: 'Pending Amount', total_dues: 'Total Dues OB', recovered: 'Total Payment Received', est_name: 'Establishment Name', est_code: 'EST Code', type: 'Type', rrc_no: 'RRC No', period: 'Period', district: 'District', eo: 'Enforcement Officer' };
  const sortLabel = labelMap[_ageingDrilldownSortKey] || _ageingDrilldownSortKey;
  const headers = ['Sl.No', 'EST Code', 'Establishment Name', 'Type', 'RRC No', 'Period', 'District', 'Enforcement Officer', 'Total Dues OB (Rs.)', 'Total Payment Received (Rs.)', 'Pending Amount (Rs.)'];
  const rows = _ageingDrilldownRecords.map((r, i) => [
    i + 1, cleanStr(r.est_code), cleanStr(r.est_name), cleanStr(r.type),
    cleanStr(r.rrc_no), cleanStr(r.period) || '-', cleanStr(r.district) || 'N/A',
    cleanStr(r.enforcement_officer) || 'Unassigned',
    fmtCur(parseFloat(r.recovery_ob) || 0).replace(/₹/g, 'Rs.'),
    fmtCur(parseFloat(r.recovered_curr_year) || 0).replace(/₹/g, 'Rs.'),
    fmtCur(parseFloat(r.pending_curr_year) || parseFloat(r.recovery_ob) || 0).replace(/₹/g, 'Rs.')
  ]);
  generateDataPdf(
    `RRC Certificates — Issued Year ${_currentAgeingYear}`,
    `${rows.length} Recovery Certificates issued in ${_currentAgeingYear} · Sorted by ${sortLabel} (${_ageingDrilldownSortAsc ? 'Ascending' : 'Descending'})`,
    headers, rows
  );
}

function exportAgeingCsv() {
  let yearMap = {};
  appData.master.forEach(r => {
    const yr = cleanStr(r.issued_year) || 'Unknown';
    if (!yearMap[yr]) yearMap[yr] = { count: 0, ob: 0, paid: 0, pending: 0 };
    yearMap[yr].count++;
    yearMap[yr].ob += parseFloat(r.recovery_ob) || 0;
    yearMap[yr].paid += parseFloat(r.recovered_curr_year) || 0;
    yearMap[yr].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let csv = 'Issued Year,Certificates,Total Dues OB,Recovered Amount,Pending Balance\n';
  Object.keys(yearMap).sort().reverse().forEach(yr => {
    const m = yearMap[yr];
    csv += `"${yr}",${m.count},${m.ob},${m.paid},${m.pending}\n`;
  });
  downloadCsvFile(csv, 'RRC_Ageing_Report.csv');
}


// 5. ACTION TAKEN & LEGAL STAGE CARD
function renderCardAction() {
  const el = document.getElementById('actionPreviewList');
  if (!el) return;

  let actionMap = {};
  appData.master.forEach(r => {
    const act = cleanStr(r.action_taken) || 'Notice / Under Recovery Process';
    actionMap[act] = (actionMap[act] || 0) + 1;
  });

  const sorted = Object.keys(actionMap).sort((a, b) => actionMap[b] - actionMap[a]);
  let html = '';
  sorted.slice(0, 3).forEach(act => {
    html += `
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${act}</span>
        <strong>${actionMap[act]} RRCs</strong>
      </div>
    `;
  });
  el.innerHTML = html;
}

function showActionModal() {
  const el = document.getElementById('actionModalBody');
  let actionMap = {};
  appData.master.forEach(r => {
    const act = cleanStr(r.action_taken) || 'Notice / Under Recovery Process';
    if (!actionMap[act]) actionMap[act] = { count: 0, ob: 0, paid: 0, pending: 0 };
    actionMap[act].count++;
    actionMap[act].ob += parseFloat(r.recovery_ob) || 0;
    actionMap[act].paid += parseFloat(r.recovered_curr_year) || 0;
    actionMap[act].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Action Taken / Legal Stage</th>
            <th class="text-center">Certificate Count</th>
            <th class="text-end">Total Dues OB (₹)</th>
            <th class="text-end">Total Payment Received (₹)</th>
            <th class="text-end">Pending Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  Object.keys(actionMap).sort((a, b) => actionMap[b].count - actionMap[a].count).forEach(act => {
    const m = actionMap[act];
    html += `
      <tr>
        <td><strong>${act}</strong></td>
        <td class="text-center">${m.count}</td>
        <td class="text-end">${fmtCur(m.ob)}</td>
        <td class="text-end val-cleared">${fmtCur(m.paid)}</td>
        <td class="text-end val-pending">${fmtCur(m.pending)}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
  openModal('actionModal');
}

function exportActionCsv() {
  let actionMap = {};
  appData.master.forEach(r => {
    const act = cleanStr(r.action_taken) || 'Notice / Under Recovery Process';
    if (!actionMap[act]) actionMap[act] = { count: 0, ob: 0, paid: 0, pending: 0 };
    actionMap[act].count++;
    actionMap[act].ob += parseFloat(r.recovery_ob) || 0;
    actionMap[act].paid += parseFloat(r.recovered_curr_year) || 0;
    actionMap[act].pending += parseFloat(r.pending_curr_year) || 0;
  });

  let csv = 'Action Taken,Certificate Count,Total Dues OB,Total Payment Received,Pending Amount\n';
  Object.keys(actionMap).forEach(act => {
    const m = actionMap[act];
    csv += `"${act}",${m.count},${m.ob},${m.paid},${m.pending}\n`;
  });
  downloadCsvFile(csv, 'Legal_Action_Taken_Report.csv');
}

// 6. COLLECTION MODE CARD
function renderCardMode() {
  const el = document.getElementById('modePreviewList');
  if (!el) return;

  let modeMap = {};
  appData.recoveryLog.forEach(l => {
    const m = cleanStr(l.receipt_no).startsWith('CH-') ? 'Cheque / DD' : 'Direct Deposit / Online';
    modeMap[m] = (modeMap[m] || 0) + (parseFloat(l.amount_deposited) || 0);
  });

  let html = '';
  Object.keys(modeMap).forEach(m => {
    html += `<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>${m}:</span> <strong style="color:var(--success);">${fmtCur(modeMap[m])}</strong></div>`;
  });
  if (!html) html = '<div style="color:var(--text-secondary);">Direct deposits recorded in Supabase.</div>';
  el.innerHTML = html;
}

function showModeModal() {
  const el = document.getElementById('modeModalBody');
  let modeMap = {};
  appData.recoveryLog.forEach(l => {
    const rcpt = cleanStr(l.receipt_no) || 'Direct Deposit';
    const m = rcpt.startsWith('CH-') ? 'Cheque / Demand Draft' : (rcpt.startsWith('PARTIAL-') ? 'Partial Direct Payment' : 'Online / Bank Attachment');
    if (!modeMap[m]) modeMap[m] = { count: 0, amount: 0 };
    modeMap[m].count++;
    modeMap[m].amount += parseFloat(l.amount_deposited) || 0;
  });

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Collection Channel / Mode</th>
            <th class="text-center">Receipt Entries</th>
            <th class="text-end">Total Amount Recovered (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  Object.keys(modeMap).forEach(m => {
    const d = modeMap[m];
    html += `
      <tr>
        <td><strong>${m}</strong></td>
        <td class="text-center">${d.count}</td>
        <td class="text-end val-cleared">${fmtCur(d.amount)}</td>
      </tr>
    `;
  });

  html += `</tbody></table></div>`;
  el.innerHTML = html;
  openModal('modeModal');
}

function exportModeCsv() {
  let modeMap = {};
  appData.recoveryLog.forEach(l => {
    const rcpt = cleanStr(l.receipt_no) || 'Direct Deposit';
    const m = rcpt.startsWith('CH-') ? 'Cheque / Demand Draft' : (rcpt.startsWith('PARTIAL-') ? 'Partial Direct Payment' : 'Online / Bank Attachment');
    if (!modeMap[m]) modeMap[m] = { count: 0, amount: 0 };
    modeMap[m].count++;
    modeMap[m].amount += parseFloat(l.amount_deposited) || 0;
  });

  let csv = 'Collection Mode,Receipt Entries,Total Amount Recovered\n';
  Object.keys(modeMap).forEach(m => {
    csv += `"${m}",${modeMap[m].count},${modeMap[m].amount}\n`;
  });
  downloadCsvFile(csv, 'Collection_Mode_Report.csv');
}

// 7. 5-ACCOUNT WISE REVENUE SPLIT CARD
function renderCardAccountSplit() {
  const el = document.getElementById('accountSplitPreviewList');
  if (!el) return;

  const accounts = ['1', '2', '10', '21', '22'];
  let accTotals = {};
  accounts.forEach(ac => {
    accTotals[ac] = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${ac}_pending`]) || parseFloat(r[`acc_${ac}_ob`]) || 0), 0);
  });

  let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Acc 1 (EPF):</span> <strong>${fmtCur(accTotals['1'])}</strong></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Acc 10 (EPS Pension):</span> <strong>${fmtCur(accTotals['10'])}</strong></div>
    <div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Acc 21 (EDLI):</span> <strong>${fmtCur(accTotals['21'])}</strong></div>
  `;
  el.innerHTML = html;
}

function showAccountSplitModal() {
  const el = document.getElementById('accountSplitModalBody');
  const accounts = [
    { key: '1', name: 'Account 1 — Employees Provident Fund (EPF)' },
    { key: '2', name: 'Account 2 — EPF Administrative Charges' },
    { key: '10', name: 'Account 10 — Employees Pension Scheme (EPS)' },
    { key: '21', name: 'Account 21 — EDLI Scheme Dues' },
    { key: '22', name: 'Account 22 — EDLI Admin Charges' }
  ];

  let html = `
    <div class="table-responsive">
      <table class="ledger-table">
        <thead>
          <tr>
            <th>Account Description</th>
            <th class="text-end">Total Dues OB (₹)</th>
            <th class="text-end">Recovered Paid (₹)</th>
            <th class="text-end">Pending Balance (₹)</th>
          </tr>
        </thead>
        <tbody>
  `;

  let totOb = 0, totPaid = 0, totPend = 0;

  accounts.forEach(a => {
    const ob = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${a.key}_ob`]) || 0), 0);
    const paid = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${a.key}_paid`]) || 0), 0);
    const pend = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${a.key}_pending`]) || 0), 0);

    totOb += ob; totPaid += paid; totPend += pend;

    html += `
      <tr>
        <td><strong>${a.name}</strong></td>
        <td class="text-end">${fmtCur(ob)}</td>
        <td class="text-end val-cleared">${fmtCur(paid)}</td>
        <td class="text-end val-pending">${fmtCur(pend)}</td>
      </tr>
    `;
  });

  html += `
        <tr class="total-row">
          <td>TOTAL ACROSS ALL 5 ACCOUNTS</td>
          <td class="text-end">${fmtCur(totOb)}</td>
          <td class="text-end val-cleared">${fmtCur(totPaid)}</td>
          <td class="text-end val-pending">${fmtCur(totPend)}</td>
        </tr>
      </tbody></table></div>
  `;

  el.innerHTML = html;
  openModal('accountSplitModal');
}

function exportAccountSplitCsv() {
  const accounts = [
    { key: '1', name: 'Account 1 - EPF' },
    { key: '2', name: 'Account 2 - EPF Admin' },
    { key: '10', name: 'Account 10 - EPS Pension' },
    { key: '21', name: 'Account 21 - EDLI' },
    { key: '22', name: 'Account 22 - EDLI Admin' }
  ];

  let csv = 'Account Description,Total Dues OB,Recovered Paid,Pending Balance\n';
  accounts.forEach(a => {
    const ob = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${a.key}_ob`]) || 0), 0);
    const paid = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${a.key}_paid`]) || 0), 0);
    const pend = appData.master.reduce((s, r) => s + (parseFloat(r[`acc_${a.key}_pending`]) || 0), 0);
    csv += `"${a.name}",${ob},${paid},${pend}\n`;
  });
  downloadCsvFile(csv, '5_Account_Revenue_Split_Report.csv');
}

// ------------------------------------------------------------------
// Bootstrap — Auth Guard Entry Point
// ------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', checkAuthAndInit);
