import sys
import os
import json
import datetime
import threading
import tkinter as tk
from tkinter import messagebox
import customtkinter as ctk
import pandas as pd

# ------------------------------------------------------------------
# Visual theme
# ------------------------------------------------------------------
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# Custom palette (used throughout instead of default CTk colors)
PALETTE = {
    "bg_main":        "#0f1117",
    "bg_sidebar":      "#151823",
    "bg_card":        "#1b1f2b",
    "bg_card_alt":    "#232838",
    "accent":         "#6C5CE7",
    "accent_hover":    "#5847d1",
    "accent_soft":    "#2a2740",
    "text_primary":   "#f4f4f6",
    "text_secondary":  "#9aa0ac",
    "success":        "#2ecc71",
    "danger":         "#ff6b6b",
    "warning":        "#f7b733",
    "border":         "#2a2e3a",
    "row_even":       "#181c27",
    "row_odd":        "#1e2330",
}

FONT_FAMILY = "Segoe UI"


class CTkDatePicker(ctk.CTkToplevel):
    """A lightweight, modern CustomTkinter calendar date picker modal."""
    def __init__(self, parent, target_entry):
        super().__init__(parent)
        self.target_entry = target_entry

        today = datetime.date.today()
        self.current_year = today.year
        self.current_month = today.month

        self.title("Select Date")
        self.geometry("300x320")
        self.resizable(False, False)
        self.configure(fg_color=PALETTE["bg_main"])
        self.grab_set()

        # Month/Year header with prev/next buttons
        header_frame = ctk.CTkFrame(self, fg_color="transparent")
        header_frame.pack(fill="x", padx=12, pady=(12, 6))

        prev_btn = ctk.CTkButton(
            header_frame, text="◀", width=30, height=28, fg_color=PALETTE["accent_soft"],
            hover_color=PALETTE["accent"], text_color=PALETTE["text_primary"], command=self.prev_month
        )
        prev_btn.pack(side="left")

        self.month_year_lbl = ctk.CTkLabel(
            header_frame, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=14, weight="bold"),
            text_color=PALETTE["text_primary"]
        )
        self.month_year_lbl.pack(side="left", expand=True)

        next_btn = ctk.CTkButton(
            header_frame, text="▶", width=30, height=28, fg_color=PALETTE["accent_soft"],
            hover_color=PALETTE["accent"], text_color=PALETTE["text_primary"], command=self.next_month
        )
        next_btn.pack(side="right")

        # Days of week header
        days_frame = ctk.CTkFrame(self, fg_color="transparent")
        days_frame.pack(fill="x", padx=12, pady=(4, 4))
        days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]
        for c, d in enumerate(days):
            days_frame.grid_columnconfigure(c, weight=1)
            ctk.CTkLabel(
                days_frame, text=d, font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"),
                text_color=PALETTE["text_secondary"]
            ).grid(row=0, column=c, sticky="nsew")

        # Calendar grid frame
        self.grid_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.grid_frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        self.render_calendar()

    def render_calendar(self):
        for widget in self.grid_frame.winfo_children():
            widget.destroy()

        import calendar
        month_name = calendar.month_name[self.current_month]
        self.month_year_lbl.configure(text=f"{month_name} {self.current_year}")

        cal = calendar.monthcalendar(self.current_year, self.current_month)

        for r, week in enumerate(cal):
            for c, day in enumerate(week):
                self.grid_frame.grid_columnconfigure(c, weight=1)
                if day == 0:
                    ctk.CTkLabel(self.grid_frame, text="", height=28).grid(row=r, column=c)
                else:
                    d_str = f"{self.current_year:04d}-{self.current_month:02d}-{day:02d}"
                    today = datetime.date.today()
                    is_today = (day == today.day and self.current_month == today.month and self.current_year == today.year)
                    bg = PALETTE["accent"] if is_today else PALETTE["bg_card"]
                    btn = ctk.CTkButton(
                        self.grid_frame, text=str(day), width=32, height=28,
                        fg_color=bg, hover_color=PALETTE["accent_hover"],
                        text_color=PALETTE["text_primary"], corner_radius=6,
                        font=ctk.CTkFont(family=FONT_FAMILY, size=12),
                        command=lambda ds=d_str: self.pick_date(ds)
                    )
                    btn.grid(row=r, column=c, padx=1, pady=1)

    def prev_month(self):
        if self.current_month == 1:
            self.current_month = 12
            self.current_year -= 1
        else:
            self.current_month -= 1
        self.render_calendar()

    def next_month(self):
        if self.current_month == 12:
            self.current_month = 1
            self.current_year += 1
        else:
            self.current_month += 1
        self.render_calendar()

    def pick_date(self, date_str):
        self.target_entry.delete(0, tk.END)
        self.target_entry.insert(0, date_str)
        self.destroy()


class RRCManagerApp(ctk.CTk):
    def __init__(self, filepath):
        super().__init__()

        self.title("EPFO Cuttack  |  RRC Master List Dashboard")
        self.geometry("1320x820")
        self.minsize(1150, 680)
        self.configure(fg_color=PALETTE["bg_main"])

        # Load data safely
        self.filepath = filepath
        self.state_file = os.path.join(os.path.dirname(os.path.abspath(self.filepath)), "app_state.json")
        self.protocol("WM_DELETE_WINDOW", self.on_app_close)

        self._initialized = False
        self._save_lock = threading.Lock()
        self.load_data()

        # Build main content FIRST so all labels exist before the sidebar's
        # initial search populates/selects a record (sidebar creation ends
        # by calling update_search_dropdown, which cascades into
        # display_specific_row and needs title_lbl etc. to already exist).
        self.create_main_content()
        self.create_sidebar()
        self.restore_app_state()

    # ------------------------------------------------------------------
    # Data
    # ------------------------------------------------------------------
    def load_data(self):
        if not os.path.exists(self.filepath):
            messagebox.showerror("Error", f"File not found:\n{self.filepath}\nPlease ensure it's in the same directory.")
            sys.exit()

        try:
            self.sheet_name = pd.ExcelFile(self.filepath).sheet_names[0]
            self.df = pd.read_excel(self.filepath, sheet_name=self.sheet_name)

            self.df.columns = self.df.columns.str.strip()
            for col in ['RRC No', 'EST CODE', 'EST NAME', 'Type']:
                if col in self.df.columns:
                    self.df[col] = self.df[col].astype(str).str.strip()

            self.rrc_list = sorted(self.df['RRC No'].dropna().unique().tolist())
            self.est_code_list = sorted(self.df['EST CODE'].dropna().unique().tolist())
            self.est_name_list = sorted(self.df['EST NAME'].dropna().unique().tolist())

            # Load the deposit log (a second sheet) if it already exists, so
            # every deposit entered through this app can feed a month-wise
            # recovery report. Created fresh if this is the first time.
            self.log_sheet_name = "Recovery Log"
            self.log_columns = [
                "Date", "EST NAME", "EST CODE", "RRC No", "Type", "Account", "Amount Deposited", "Period"
            ]
            all_sheets = pd.ExcelFile(self.filepath).sheet_names
            if self.log_sheet_name in all_sheets:
                self.recovery_log = pd.read_excel(self.filepath, sheet_name=self.log_sheet_name)
            else:
                self.recovery_log = pd.DataFrame(columns=self.log_columns)

            # Load the fully-recovered log (a third sheet). One entry is
            # added the moment a certificate's outstanding balance first
            # drops to zero, so this becomes a running record of which
            # establishments got fully cleared, and in which month.
            self.fully_recovered_sheet_name = "Fully Recovered Log"
            self.fully_recovered_columns = [
                "Date", "Month", "EST NAME", "EST CODE", "RRC No", "Type", "Period", "Total Due", "Total Recovered"
            ]
            if self.fully_recovered_sheet_name in all_sheets:
                self.fully_recovered_log = pd.read_excel(self.filepath, sheet_name=self.fully_recovered_sheet_name)
            else:
                self.fully_recovered_log = pd.DataFrame(columns=self.fully_recovered_columns)

            # Track which rows (by original DataFrame index) are already
            # known to be fully recovered, so we only log the transition
            # once rather than on every subsequent edit.
            if "Fully Recovered" not in self.df.columns:
                self.df["Fully Recovered"] = ""
            self.fully_recovered_rows = set(
                self.df.index[self.df["Fully Recovered"].astype(str).str.strip() == "Yes"].tolist()
            )

        except Exception as e:
            messagebox.showerror("Data Error", f"Failed to parse excel file:\n{str(e)}")
            sys.exit()

    # ------------------------------------------------------------------
    # Sidebar
    # ------------------------------------------------------------------
    def create_sidebar(self):
        self.sidebar = ctk.CTkFrame(self, width=330, corner_radius=0, fg_color=PALETTE["bg_sidebar"])
        self.sidebar.pack(side="left", fill="y", padx=0, pady=0)
        self.sidebar.pack_propagate(False)

        # Brand block with accent chip
        brand_frame = ctk.CTkFrame(self.sidebar, fg_color="transparent")
        brand_frame.pack(fill="x", padx=24, pady=(32, 8))

        chip = ctk.CTkFrame(brand_frame, width=42, height=42, corner_radius=12, fg_color=PALETTE["accent"])
        chip.pack(side="left", padx=(0, 12))
        chip.pack_propagate(False)
        chip_lbl = ctk.CTkLabel(chip, text="⚖", font=ctk.CTkFont(family=FONT_FAMILY, size=20))
        chip_lbl.place(relx=0.5, rely=0.5, anchor="center")

        text_frame = ctk.CTkFrame(brand_frame, fg_color="transparent")
        text_frame.pack(side="left")
        ctk.CTkLabel(
            text_frame, text="EPFO CUTTACK", font=ctk.CTkFont(family=FONT_FAMILY, size=17, weight="bold"),
            text_color=PALETTE["text_primary"], anchor="w"
        ).pack(anchor="w")
        ctk.CTkLabel(
            text_frame, text="RRC Recovery Dashboard", font=ctk.CTkFont(family=FONT_FAMILY, size=12),
            text_color=PALETTE["text_secondary"], anchor="w"
        ).pack(anchor="w")

        self._divider(self.sidebar, pady=(20, 18))

        # Search criteria section
        self._section_label(self.sidebar, "SEARCH BY")

        self.search_mode = ctk.CTkSegmentedButton(
            self.sidebar, values=["RRC No", "Est Code", "Est Name"],
            command=self.update_search_dropdown,
            fg_color=PALETTE["bg_card"], selected_color=PALETTE["accent"],
            selected_hover_color=PALETTE["accent_hover"], unselected_color=PALETTE["bg_card"],
            unselected_hover_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"],
            font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
            corner_radius=10,
        )
        self.search_mode.pack(padx=24, pady=(4, 18), fill="x")
        self.search_mode.set("Est Code")

        # Search box
        self._section_label(self.sidebar, "QUICK SEARCH")

        self.filter_entry = ctk.CTkEntry(
            self.sidebar, placeholder_text="🔍  Type name, code or RRC no...",
            fg_color=PALETTE["bg_card"], border_color=PALETTE["border"], border_width=1,
            text_color=PALETTE["text_primary"], corner_radius=10, height=38,
            font=ctk.CTkFont(family=FONT_FAMILY, size=13),
        )
        self.filter_entry.pack(padx=24, pady=(4, 18), fill="x")
        self.filter_entry.bind("<KeyRelease>", self.filter_options)

        # Matched items dropdown
        self._section_label(self.sidebar, "MATCHING RESULTS")

        self.search_var = tk.StringVar()
        self.search_dropdown = ctk.CTkOptionMenu(
            self.sidebar, variable=self.search_var, dynamic_resizing=True, command=self.on_record_select,
            fg_color=PALETTE["bg_card"], button_color=PALETTE["accent"], button_hover_color=PALETTE["accent_hover"],
            text_color=PALETTE["text_primary"], dropdown_fg_color=PALETTE["bg_card"],
            dropdown_text_color=PALETTE["text_primary"], dropdown_hover_color=PALETTE["accent_soft"],
            corner_radius=10, height=36, font=ctk.CTkFont(family=FONT_FAMILY, size=12),
        )
        self.search_dropdown.pack(padx=24, pady=(4, 18), fill="x")

        # Record selector (multiple rows for same establishment)
        self._section_label(self.sidebar, "AVAILABLE RRC ROWS")

        self.matched_records_box = ctk.CTkOptionMenu(
            self.sidebar, command=self.display_specific_row,
            fg_color=PALETTE["bg_card"], button_color=PALETTE["accent"], button_hover_color=PALETTE["accent_hover"],
            text_color=PALETTE["text_primary"], dropdown_fg_color=PALETTE["bg_card"],
            dropdown_text_color=PALETTE["text_primary"], dropdown_hover_color=PALETTE["accent_soft"],
            corner_radius=10, height=36, font=ctk.CTkFont(family=FONT_FAMILY, size=12),
        )
        self.matched_records_box.pack(padx=24, pady=(4, 24), fill="x")

        self.reset_btn = ctk.CTkButton(
            self.sidebar, text="Clear Search", fg_color="transparent", border_width=1,
            border_color=PALETTE["border"], hover_color=PALETTE["accent_soft"],
            text_color=PALETTE["text_secondary"], corner_radius=10, height=38,
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            command=self.reset_ui,
        )
        self.reset_btn.pack(padx=24, pady=(0, 12), fill="x")

        self.report_btn = ctk.CTkButton(
            self.sidebar, text="📊  Monthly Recovery Report", fg_color=PALETTE["accent"],
            hover_color=PALETTE["accent_hover"], text_color=PALETTE["text_primary"], corner_radius=10, height=38,
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            command=self.show_monthly_report,
        )
        self.report_btn.pack(padx=24, pady=(0, 12), fill="x")

        self.fully_recovered_btn = ctk.CTkButton(
            self.sidebar, text="✅  Fully Recovered Report", fg_color=PALETTE["success"],
            hover_color="#26a65b", text_color=PALETTE["bg_main"], corner_radius=10, height=38,
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            command=self.show_fully_recovered_report,
        )
        self.fully_recovered_btn.pack(padx=24, pady=(0, 20), fill="x")

        # Footer note pinned to bottom
        footer = ctk.CTkLabel(
            self.sidebar, text="Employees' Provident Fund Organisation",
            font=ctk.CTkFont(family=FONT_FAMILY, size=10), text_color=PALETTE["text_secondary"],
        )
        footer.pack(side="bottom", pady=18)

        self.update_search_dropdown("Est Code")

    def _divider(self, parent, pady=(10, 10)):
        sep = ctk.CTkFrame(parent, height=1, fg_color=PALETTE["border"])
        sep.pack(fill="x", padx=24, pady=pady)

    def _section_label(self, parent, text):
        lbl = ctk.CTkLabel(
            parent, text=text, font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"),
            text_color=PALETTE["text_secondary"], anchor="w",
        )
        lbl.pack(padx=24, pady=(0, 6), anchor="w")

    # ------------------------------------------------------------------
    # Main content
    # ------------------------------------------------------------------
    def create_main_content(self):
        self.main_panel = ctk.CTkScrollableFrame(self, corner_radius=0, fg_color=PALETTE["bg_main"])
        self.main_panel.pack(side="right", fill="both", expand=True, padx=0, pady=0)

        # Top header bar
        self.meta_frame = ctk.CTkFrame(self.main_panel, fg_color=PALETTE["bg_card"], corner_radius=16)
        self.meta_frame.pack(fill="x", padx=28, pady=(28, 16))

        inner_meta = ctk.CTkFrame(self.meta_frame, fg_color="transparent")
        inner_meta.pack(fill="x", padx=24, pady=20)

        self.title_lbl = ctk.CTkLabel(
            inner_meta, text="Select an establishment to populate metrics",
            font=ctk.CTkFont(family=FONT_FAMILY, size=24, weight="bold"), text_color=PALETTE["text_primary"],
            anchor="w",
        )
        self.title_lbl.pack(anchor="w")

        self.subtitle_lbl = ctk.CTkLabel(
            inner_meta, text="Establishment specific details will appear below",
            font=ctk.CTkFont(family=FONT_FAMILY, size=13), text_color=PALETTE["text_secondary"], anchor="w",
        )
        self.subtitle_lbl.pack(anchor="w", pady=(4, 10))

        self.recovery_lbl = ctk.CTkLabel(
            inner_meta, text="Recovery Field: Not Selected",
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"), text_color=PALETTE["accent"], anchor="w",
        )
        self.recovery_lbl.pack(anchor="w")

        self.save_status_lbl = ctk.CTkLabel(
            inner_meta, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"],
            anchor="w",
        )
        self.save_status_lbl.pack(anchor="w", pady=(4, 0))

        # Ledger table title
        ac_title = ctk.CTkLabel(
            self.main_panel, text="Certificate Ledger Breakdown",
            font=ctk.CTkFont(family=FONT_FAMILY, size=17, weight="bold"), text_color=PALETTE["text_primary"],
        )
        ac_title.pack(anchor="w", padx=28, pady=(4, 10))

        # Container that holds one card per certificate row in the selected
        # group (e.g. the 7A card followed by its linked 7Q card, stacked
        # together so both show up in the same place at once).
        self.tables_container = ctk.CTkFrame(self.main_panel, fg_color="transparent")
        self.tables_container.pack(fill="x", padx=28, pady=(0, 28))

    def _build_certificate_card(self, parent, row):
        """Render one certificate's mini-header + editable ledger table as its own card."""
        row_index = row.name  # original index in self.df, used to write edits back

        card = ctk.CTkFrame(parent, corner_radius=16, fg_color=PALETTE["bg_card"])
        card.pack(fill="x", pady=(0, 16))

        header = ctk.CTkFrame(card, fg_color="transparent")
        header.pack(fill="x", padx=20, pady=(16, 8))

        type_badge = ctk.CTkFrame(header, corner_radius=8, fg_color=PALETTE["accent_soft"])
        type_badge.pack(side="left")
        ctk.CTkLabel(
            type_badge, text=f"  {row.get('Type', 'N/A')}  ",
            font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"), text_color=PALETTE["accent"],
        ).pack(padx=4, pady=4)

        ctk.CTkLabel(
            header, text=f"RRC No: {row.get('RRC No', 'N/A')}   •   Period: {row.get('Period', 'N/A')}",
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"), text_color=PALETTE["text_primary"],
        ).pack(side="left", padx=(12, 0))

        if str(row.get("Fully Recovered", "")).strip() == "Yes":
            recovered_badge = ctk.CTkFrame(header, corner_radius=8, fg_color=PALETTE["success"])
            recovered_badge.pack(side="left", padx=(12, 0))
            ctk.CTkLabel(
                recovered_badge, text="  ✅ Fully Recovered  ",
                font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"), text_color=PALETTE["bg_main"],
            ).pack(padx=2, pady=2)

        ctk.CTkLabel(
            header, text="Deposited column is editable — press Enter or click away to save",
            font=ctk.CTkFont(family=FONT_FAMILY, size=11), text_color=PALETTE["text_secondary"],
        ).pack(side="right")

        table = ctk.CTkFrame(card, fg_color="transparent")
        table.pack(fill="x", padx=20, pady=(0, 16))

        headers = ["Account Type", "Dues Amount (OB)", "Deposited (Paid)", "Outstanding Balance", "History / Payments"]
        for c, h in enumerate(headers):
            table.grid_columnconfigure(c, weight=1)
            lbl = ctk.CTkLabel(
                table, text=h, font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
                fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=36,
            )
            lbl.grid(row=0, column=c, sticky="nsew", padx=1, pady=1)

        accounts = ['1', '2', '10', '21', '22']
        due_values = {}
        paid_entries = {}
        balance_labels = {}

        for r_idx, ac in enumerate(accounts, start=1):
            due = pd.to_numeric(row.get(f"{ac} OB", 0), errors='coerce')
            paid = pd.to_numeric(row.get(f"{ac} paid (26-27)", 0), errors='coerce')
            pending = pd.to_numeric(row.get(f"{ac} pending", 0), errors='coerce')

            due = 0.0 if pd.isna(due) else due
            paid = 0.0 if pd.isna(paid) else paid
            pending = 0.0 if pd.isna(pending) else pending
            due_values[ac] = due

            bg_toggle = PALETTE["row_even"] if r_idx % 2 == 0 else PALETTE["row_odd"]

            lbl_acc = ctk.CTkLabel(
                table, text=f"Account {ac}", font=ctk.CTkFont(family=FONT_FAMILY, size=13),
                fg_color=bg_toggle, text_color=PALETTE["text_primary"], height=36,
            )
            lbl_acc.grid(row=r_idx, column=0, sticky="nsew", padx=1, pady=1)

            lbl_due = ctk.CTkLabel(
                table, text=f"₹ {due:,.2f}", font=ctk.CTkFont(family=FONT_FAMILY, size=13),
                fg_color=bg_toggle, text_color=PALETTE["text_primary"], height=36, anchor="e",
            )
            lbl_due.grid(row=r_idx, column=1, sticky="nsew", padx=1, pady=1)

            paid_entry = ctk.CTkEntry(
                table, fg_color=bg_toggle, text_color=PALETTE["text_primary"], border_width=0,
                corner_radius=0, height=36, font=ctk.CTkFont(family=FONT_FAMILY, size=13),
                justify="right",
            )
            paid_entry.insert(0, f"{paid:,.2f}")
            paid_entry.grid(row=r_idx, column=2, sticky="nsew", padx=1, pady=1)
            paid_entries[ac] = paid_entry

            lbl_bal = ctk.CTkLabel(
                table, text=f"₹ {pending:,.2f}", font=ctk.CTkFont(family=FONT_FAMILY, size=13),
                fg_color=bg_toggle, text_color=PALETTE["danger"] if pending > 0 else PALETTE["success"], height=36, anchor="e",
            )
            lbl_bal.grid(row=r_idx, column=3, sticky="nsew", padx=1, pady=1)
            balance_labels[ac] = lbl_bal

            hist_btn = ctk.CTkButton(
                table, text="📜 History", font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"),
                fg_color=PALETTE["accent_soft"], hover_color=PALETTE["accent"], text_color=PALETTE["text_primary"],
                corner_radius=6, height=28, width=80,
                command=lambda ac=ac: self.show_account_payment_history(row_index, ac, due_values, paid_entries, balance_labels, total_labels)
            )
            hist_btn.grid(row=r_idx, column=4, padx=2, pady=1)

        # Totals row for this certificate (sum across its 5 accounts)
        total_row_idx = len(accounts) + 1
        total_due_lbl = ctk.CTkLabel(
            table, text="Total", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=38,
        )
        total_due_lbl.grid(row=total_row_idx, column=0, sticky="nsew", padx=1, pady=1)

        total_ob_lbl = ctk.CTkLabel(
            table, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=38, anchor="e",
        )
        total_ob_lbl.grid(row=total_row_idx, column=1, sticky="nsew", padx=1, pady=1)

        total_paid_lbl = ctk.CTkLabel(
            table, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=38, anchor="e",
        )
        total_paid_lbl.grid(row=total_row_idx, column=2, sticky="nsew", padx=1, pady=1)

        total_bal_lbl = ctk.CTkLabel(
            table, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=38, anchor="e",
        )
        total_bal_lbl.grid(row=total_row_idx, column=3, sticky="nsew", padx=1, pady=1)

        total_hist_lbl = ctk.CTkLabel(
            table, text="", fg_color=PALETTE["accent_soft"], height=38
        )
        total_hist_lbl.grid(row=total_row_idx, column=4, sticky="nsew", padx=1, pady=1)

        total_labels = {"ob": total_ob_lbl, "paid": total_paid_lbl, "bal": total_bal_lbl}

        # Wire up live recompute + save-to-Excel for every account's deposit entry
        for ac, entry in paid_entries.items():
            handler = lambda event, ac=ac: self._on_paid_edited(
                row_index, ac, due_values, paid_entries, balance_labels, total_labels
            )
            entry.bind("<Return>", handler)
            entry.bind("<FocusOut>", handler)
            entry.bind("<Button-1>", self._clear_zero_on_click, add="+")

        # Populate the totals row with the initial figures
        self._recompute_certificate_totals(due_values, paid_entries, balance_labels, total_labels, initial=True)

        # Build embedded Date-Wise Receipt & Payment Ledger Card section directly under the certificate card
        self._build_ledger_card_section(card, row, row_index, due_values, paid_entries, balance_labels, total_labels)

    def _recompute_certificate_totals(self, due_values, paid_entries, balance_labels, total_labels, initial=False):
        """Recompute and redraw the Total row for one certificate card from its current entry values."""
        total_due = 0.0
        total_paid = 0.0
        for ac, entry in paid_entries.items():
            raw = entry.get().strip().replace(",", "").replace("₹", "")
            try:
                paid_val = float(raw) if raw else 0.0
            except ValueError:
                paid_val = 0.0
            total_due += due_values[ac]
            total_paid += paid_val
        total_pending = total_due - total_paid

        total_labels["ob"].configure(text=f"₹ {total_due:,.2f}")
        total_labels["paid"].configure(text=f"₹ {total_paid:,.2f}")
        total_labels["bal"].configure(
            text=f"₹ {total_pending:,.2f}",
            text_color=PALETTE["danger"] if total_pending > 0 else PALETTE["success"],
        )
        return total_due, total_paid, total_pending

    def _build_ledger_card_section(self, parent, row, row_index, due_values, paid_entries, balance_labels, total_labels):
        """Render a date-wise payment receipt ledger card below the certificate account table."""
        rrc_no = str(row.get("RRC No", "N/A"))
        rrc_type = str(row.get("Type", "N/A"))
        est_name = str(row.get("EST NAME", "N/A"))
        est_code = str(row.get("EST CODE", "N/A"))
        period = str(row.get("Period", "N/A"))

        ledger_card = ctk.CTkFrame(parent, corner_radius=12, fg_color=PALETTE["bg_card_alt"])
        ledger_card.pack(fill="x", padx=20, pady=(0, 16))

        # Header bar
        header_frame = ctk.CTkFrame(ledger_card, fg_color="transparent")
        header_frame.pack(fill="x", padx=16, pady=(12, 8))

        ctk.CTkLabel(
            header_frame, text=f"📖 Date-Wise Payment Receipts Ledger ({rrc_type} — RRC: {rrc_no})",
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"), text_color=PALETTE["text_primary"]
        ).pack(side="left")

        ctk.CTkLabel(
            header_frame, text="Record date-wise payments (like bill receipts) — totals update automatically",
            font=ctk.CTkFont(family=FONT_FAMILY, size=11), text_color=PALETTE["text_secondary"]
        ).pack(side="left", padx=(12, 0))

        # Input form frame
        form_frame = ctk.CTkFrame(ledger_card, fg_color=PALETTE["bg_card"], corner_radius=10)
        form_frame.pack(fill="x", padx=16, pady=(0, 12))

        form_grid = ctk.CTkFrame(form_frame, fg_color="transparent")
        form_grid.pack(fill="x", padx=12, pady=10)

        # Form fields: Date, Receipt No, Acc 1, Acc 2, Acc 10, Acc 21, Acc 22
        ctk.CTkLabel(form_grid, text="Date:", font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"), text_color=PALETTE["text_secondary"]).grid(row=0, column=0, padx=4, pady=2, sticky="w")
        
        date_frame = ctk.CTkFrame(form_grid, fg_color="transparent")
        date_frame.grid(row=1, column=0, padx=4, pady=2)

        date_ent = ctk.CTkEntry(date_frame, width=95, height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=12))
        date_ent.insert(0, datetime.date.today().isoformat())
        date_ent.pack(side="left")

        picker_btn = ctk.CTkButton(
            date_frame, text="📅", width=26, height=28, fg_color=PALETTE["accent_soft"],
            hover_color=PALETTE["accent"], text_color=PALETTE["text_primary"], corner_radius=6,
            font=ctk.CTkFont(size=11),
            command=lambda: CTkDatePicker(self, date_ent)
        )
        picker_btn.pack(side="left", padx=(3, 0))

        ctk.CTkLabel(form_grid, text="Receipt/Challan No:", font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"), text_color=PALETTE["text_secondary"]).grid(row=0, column=1, padx=4, pady=2, sticky="w")
        rcpt_ent = ctk.CTkEntry(form_grid, width=120, height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=12), placeholder_text="e.g. CH-1029")
        rcpt_ent.grid(row=1, column=1, padx=4, pady=2)

        accounts = ['1', '2', '10', '21', '22']
        acc_entries = {}
        for c_idx, ac in enumerate(accounts, start=2):
            ctk.CTkLabel(form_grid, text=f"Acc {ac} (₹):", font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"), text_color=PALETTE["text_secondary"]).grid(row=0, column=c_idx, padx=4, pady=2, sticky="w")
            a_ent = ctk.CTkEntry(form_grid, width=85, height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=12), placeholder_text="0.00", justify="right")
            a_ent.grid(row=1, column=c_idx, padx=4, pady=2)
            acc_entries[ac] = a_ent

        # State for editing an existing payment receipt
        edit_state = {"g_key": None}

        table_frame = ctk.CTkScrollableFrame(ledger_card, height=220, fg_color="transparent")
        table_frame.pack(fill="x", padx=16, pady=(0, 12))

        def _clean_str(val):
            if pd.isna(val):
                return ""
            s = str(val).strip()
            if s.endswith(".0"):
                s = s[:-2]
            return s

        def _clean_rcpt(val):
            if pd.isna(val):
                return "-"
            s = str(val).strip()
            if s.endswith(".0"):
                s = s[:-2]
            return s if s and s != "nan" else "-"

        def start_edit_receipt_group(g_key, group):
            edit_state["g_key"] = g_key
            dt = str(group["Date"].iloc[0])[:10]
            rcpt = _clean_rcpt(group["Receipt No"].iloc[0]) if "Receipt No" in group.columns else ""

            date_ent.delete(0, tk.END)
            date_ent.insert(0, dt)

            rcpt_ent.delete(0, tk.END)
            rcpt_ent.insert(0, rcpt if rcpt != "-" else "")

            for ac in accounts:
                acc_rows = group[group["Account"].astype(str) == ac]
                val = acc_rows["Amount Deposited"].sum() if not acc_rows.empty else 0.0
                acc_entries[ac].delete(0, tk.END)
                if val > 0:
                    acc_entries[ac].insert(0, f"{val:.2f}")

            add_rec_btn.configure(text="💾 Update Receipt", fg_color=PALETTE["warning"], hover_color="#e67e22")
            cancel_btn.pack(side="left", padx=4)

        def cancel_edit():
            edit_state["g_key"] = None
            date_ent.delete(0, tk.END)
            date_ent.insert(0, datetime.date.today().isoformat())
            rcpt_ent.delete(0, tk.END)
            for ac in accounts:
                acc_entries[ac].delete(0, tk.END)

            add_rec_btn.configure(text="➕ Record Receipt", fg_color=PALETTE["accent"], hover_color=PALETTE["accent_hover"])
            cancel_btn.pack_forget()

        def refresh_ledger_table():
            for widget in table_frame.winfo_children():
                widget.destroy()

            headers = ["Payment Date", "Receipt No", "Acc 1 (₹)", "Acc 2 (₹)", "Acc 10 (₹)", "Acc 21 (₹)", "Acc 22 (₹)", "Total Paid (₹)", "Action"]
            for c, h in enumerate(headers):
                table_frame.grid_columnconfigure(c, weight=1)
                ctk.CTkLabel(
                    table_frame, text=h, font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"),
                    fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=28
                ).grid(row=0, column=c, sticky="nsew", padx=1, pady=1)

            c_rrc = _clean_str(rrc_no)
            c_type = _clean_str(rrc_type)
            c_est = _clean_str(est_code)

            if "EST CODE" in self.recovery_log.columns and (self.recovery_log["EST CODE"].apply(_clean_str) == c_est).any():
                mask = (self.recovery_log["EST CODE"].apply(_clean_str) == c_est) & (self.recovery_log["Type"].apply(_clean_str) == c_type)
            else:
                mask = (self.recovery_log["RRC No"].apply(_clean_str) == c_rrc) & (self.recovery_log["Type"].apply(_clean_str) == c_type)

            logs = self.recovery_log[mask].copy()

            if logs.empty:
                ctk.CTkLabel(
                    table_frame, text="No date-wise payment receipts recorded yet for this certificate.",
                    font=ctk.CTkFont(family=FONT_FAMILY, size=11), text_color=PALETTE["text_secondary"], height=32
                ).grid(row=1, column=0, columnspan=9, pady=6)
                return

            if "Receipt No" not in logs.columns:
                logs["Receipt No"] = ""

            if "Txn_ID" in logs.columns and logs["Txn_ID"].notna().any():
                logs["GroupKey"] = logs["Txn_ID"].astype(str)
            else:
                logs["GroupKey"] = logs["Date"].astype(str) + "___" + logs["Receipt No"].astype(str) + "___" + logs.index.astype(str)

            grouped = logs.groupby("GroupKey", sort=False)

            r_num = 1
            for g_key, group in grouped:
                bg = PALETTE["row_even"] if r_num % 2 == 0 else PALETTE["row_odd"]
                dt = str(group["Date"].iloc[0])[:10]
                rcpt = _clean_rcpt(group["Receipt No"].iloc[0]) if "Receipt No" in group.columns else "-"

                acc_sums = {}
                row_total = 0.0
                for ac in accounts:
                    ac_rows = group[group["Account"].astype(str) == ac]
                    val = ac_rows["Amount Deposited"].sum() if not ac_rows.empty else 0.0
                    acc_sums[ac] = val
                    row_total += val

                ctk.CTkLabel(table_frame, text=dt, fg_color=bg, text_color=PALETTE["text_primary"], height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=11)).grid(row=r_num, column=0, sticky="nsew", padx=1, pady=1)
                ctk.CTkLabel(table_frame, text=rcpt, fg_color=bg, text_color=PALETTE["text_primary"], height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=11)).grid(row=r_num, column=1, sticky="nsew", padx=1, pady=1)

                for c_idx, ac in enumerate(accounts, start=2):
                    v = acc_sums[ac]
                    v_str = f"₹ {v:,.2f}" if v > 0 else "-"
                    ctk.CTkLabel(table_frame, text=v_str, fg_color=bg, text_color=PALETTE["text_primary"] if v > 0 else PALETTE["text_secondary"], height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=11), anchor="e").grid(row=r_num, column=c_idx, sticky="nsew", padx=1, pady=1)

                ctk.CTkLabel(table_frame, text=f"₹ {row_total:,.2f}", fg_color=bg, text_color=PALETTE["success"], height=28, font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"), anchor="e").grid(row=r_num, column=7, sticky="nsew", padx=1, pady=1)

                btn_frame = ctk.CTkFrame(table_frame, fg_color="transparent")
                btn_frame.grid(row=r_num, column=8, padx=2, pady=1)

                edit_btn = ctk.CTkButton(
                    btn_frame, text="✏️", width=26, height=24, fg_color=PALETTE["accent"], hover_color=PALETTE["accent_hover"],
                    text_color="#ffffff", corner_radius=4, font=ctk.CTkFont(size=10),
                    command=lambda g_key=g_key, grp=group: start_edit_receipt_group(g_key, grp)
                )
                edit_btn.pack(side="left", padx=(0, 2))

                del_btn = ctk.CTkButton(
                    btn_frame, text="🗑", width=26, height=24, fg_color=PALETTE["danger"], hover_color="#d63031",
                    text_color="#ffffff", corner_radius=4, font=ctk.CTkFont(size=10),
                    command=lambda g_key=g_key: delete_receipt_group(g_key)
                )
                del_btn.pack(side="left")

                r_num += 1

        def save_receipt_entry():
            p_date = date_ent.get().strip()
            rcpt_no = rcpt_ent.get().strip()

            try:
                datetime.date.fromisoformat(p_date)
            except ValueError:
                messagebox.showerror("Invalid Date", "Please enter a valid date in YYYY-MM-DD format.")
                return

            new_entries = []
            total_added = 0.0
            is_updating = edit_state["g_key"] is not None
            txn_id = edit_state["g_key"] if is_updating else datetime.datetime.now().strftime("TXN_%Y%m%d_%H%M%S_%f")

            for ac in accounts:
                raw = acc_entries[ac].get().strip().replace(",", "").replace("₹", "")
                if not raw:
                    continue
                try:
                    val = float(raw)
                    if val > 0:
                        total_added += val
                        new_entries.append({
                            "Txn_ID": txn_id,
                            "Date": p_date,
                            "Receipt No": rcpt_no,
                            "EST NAME": est_name,
                            "EST CODE": est_code,
                            "RRC No": rrc_no,
                            "Type": rrc_type,
                            "Account": ac,
                            "Amount Deposited": val,
                            "Period": period,
                        })
                except ValueError:
                    messagebox.showerror("Invalid Amount", f"Please enter a valid number for Account {ac}.")
                    return

            if not new_entries:
                messagebox.showwarning("No Amount Entered", "Please enter a payment amount for at least one account.")
                return

            if "Receipt No" not in self.recovery_log.columns:
                self.recovery_log["Receipt No"] = ""
            if "Txn_ID" not in self.recovery_log.columns:
                self.recovery_log["Txn_ID"] = ""

            # If editing/updating, remove old log entries for this receipt first
            if is_updating:
                g_key = edit_state["g_key"]
                if (self.recovery_log["Txn_ID"].astype(str) == g_key).any():
                    old_mask = self.recovery_log["Txn_ID"].astype(str) == g_key
                else:
                    parts = g_key.split("___")
                    dt_part = parts[0]
                    rcpt_part = parts[1] if len(parts) > 1 else ""
                    idx_part = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else None
                    if idx_part is not None and idx_part in self.recovery_log.index:
                        old_mask = self.recovery_log.index == idx_part
                    else:
                        old_mask = (
                            (self.recovery_log["Date"].astype(str).str.startswith(dt_part)) &
                            (self.recovery_log.get("Receipt No", pd.Series()).astype(str).str.strip() == rcpt_part)
                        )
                self.recovery_log = self.recovery_log[~old_mask].reset_index(drop=True)

            self.recovery_log = pd.concat([self.recovery_log, pd.DataFrame(new_entries)], ignore_index=True)

            # Auto-adjust total paid amounts and outstanding balances in summary table
            for ac in accounts:
                mask = self._get_certificate_recovery_mask(est_code, rrc_no, rrc_type, account=ac)
                ac_total_paid = self.recovery_log[mask]["Amount Deposited"].sum() if not self.recovery_log.empty and mask.any() else 0.0
                due_val = due_values[ac]
                pending_val = due_val - ac_total_paid

                self.df.loc[row_index, f"{ac} paid (26-27)"] = ac_total_paid
                self.df.loc[row_index, f"{ac} pending"] = pending_val

                paid_entries[ac].delete(0, tk.END)
                paid_entries[ac].insert(0, f"{ac_total_paid:,.2f}")
                balance_labels[ac].configure(
                    text=f"₹ {pending_val:,.2f}",
                    text_color=PALETTE["danger"] if pending_val > 0 else PALETTE["success"]
                )

            total_ob, total_paid, total_pending = self._recompute_certificate_totals(due_values, paid_entries, balance_labels, total_labels)
            self.df.loc[row_index, "Recovery OB"] = total_ob
            self.df.loc[row_index, "Recovered in current year (26-27)"] = total_paid
            self.df.loc[row_index, "Recovery pending for current year"] = total_pending

            self._trigger_async_save()

            cancel_edit()
            self._refresh_matched_group_row(row_index)
            refresh_ledger_table()

        def delete_receipt_group(g_key):
            if not messagebox.askyesno("Confirm Delete", "Delete this date-wise payment receipt record?"):
                return

            if "Txn_ID" in self.recovery_log.columns and (self.recovery_log["Txn_ID"].astype(str) == g_key).any():
                mask = self.recovery_log["Txn_ID"].astype(str) == g_key
            else:
                parts = g_key.split("___")
                dt_part = parts[0]
                rcpt_part = parts[1] if len(parts) > 1 else ""
                idx_part = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else None
                if idx_part is not None and idx_part in self.recovery_log.index:
                    mask = self.recovery_log.index == idx_part
                else:
                    mask = (
                        (self.recovery_log["Date"].astype(str).str.startswith(dt_part)) &
                        (self.recovery_log.get("Receipt No", pd.Series()).astype(str).str.strip() == rcpt_part)
                    )

            self.recovery_log = self.recovery_log[~mask].reset_index(drop=True)

            for ac in accounts:
                m_ac = self._get_certificate_recovery_mask(est_code, rrc_no, rrc_type, account=ac)
                ac_total_paid = self.recovery_log[m_ac]["Amount Deposited"].sum() if not self.recovery_log.empty and m_ac.any() else 0.0
                due_val = due_values[ac]
                pending_val = due_val - ac_total_paid

                self.df.loc[row_index, f"{ac} paid (26-27)"] = ac_total_paid
                self.df.loc[row_index, f"{ac} pending"] = pending_val

                paid_entries[ac].delete(0, tk.END)
                paid_entries[ac].insert(0, f"{ac_total_paid:,.2f}")
                balance_labels[ac].configure(
                    text=f"₹ {pending_val:,.2f}",
                    text_color=PALETTE["danger"] if pending_val > 0 else PALETTE["success"]
                )

            total_ob, total_paid, total_pending = self._recompute_certificate_totals(due_values, paid_entries, balance_labels, total_labels)
            self.df.loc[row_index, "Recovery OB"] = total_ob
            self.df.loc[row_index, "Recovered in current year (26-27)"] = total_paid
            self.df.loc[row_index, "Recovery pending for current year"] = total_pending

            self._trigger_async_save()
            self._refresh_matched_group_row(row_index)
            refresh_ledger_table()

        btn_container = ctk.CTkFrame(form_grid, fg_color="transparent")
        btn_container.grid(row=1, column=7, padx=8, pady=2)

        add_rec_btn = ctk.CTkButton(
            btn_container, text="➕ Record Receipt", font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"),
            fg_color=PALETTE["accent"], hover_color=PALETTE["accent_hover"], height=28,
            command=save_receipt_entry
        )
        add_rec_btn.pack(side="left")

        cancel_btn = ctk.CTkButton(
            btn_container, text="✖ Cancel", font=ctk.CTkFont(family=FONT_FAMILY, size=11, weight="bold"),
            fg_color=PALETTE["danger"], hover_color="#d63031", height=28, width=70,
            command=cancel_edit
        )

        # Wire up smooth Tab, Shift-Tab, and Enter keyboard navigation
        form_fields = [date_ent, rcpt_ent] + [acc_entries[ac] for ac in accounts]

        def _focus_next(event, next_widget):
            next_widget.focus_set()
            return "break"

        def _focus_prev(event, prev_widget):
            prev_widget.focus_set()
            return "break"

        for idx, field in enumerate(form_fields):
            next_w = form_fields[idx + 1] if idx + 1 < len(form_fields) else add_rec_btn
            prev_w = form_fields[idx - 1] if idx - 1 >= 0 else None

            field.bind("<Tab>", lambda e, nw=next_w: _focus_next(e, nw))
            if prev_w:
                field.bind("<Shift-Tab>", lambda e, pw=prev_w: _focus_prev(e, pw))
            field.bind("<Return>", lambda e: save_receipt_entry())

        refresh_ledger_table()

    def _get_certificate_recovery_mask(self, est_code, rrc_no, rrc_type, account=None):
        """Unified mask generator to retrieve recovery log entries for a certificate."""
        def _clean(val):
            if pd.isna(val):
                return ""
            s = str(val).strip()
            if s.endswith(".0"):
                s = s[:-2]
            return s

        c_est = _clean(est_code)
        c_rrc = _clean(rrc_no)
        c_type = _clean(rrc_type)

        if "EST CODE" in self.recovery_log.columns and c_est and (self.recovery_log["EST CODE"].apply(_clean) == c_est).any():
            mask = (self.recovery_log["EST CODE"].apply(_clean) == c_est) & (self.recovery_log["Type"].apply(_clean) == c_type)
        else:
            mask = (self.recovery_log["RRC No"].apply(_clean) == c_rrc) & (self.recovery_log["Type"].apply(_clean) == c_type)

        if account is not None and "Account" in self.recovery_log.columns:
            mask = mask & (self.recovery_log["Account"].apply(_clean) == str(account))

        return mask

    def _clear_zero_on_click(self, event):
        """When a deposit field showing 0.00 is clicked, blank it so the user
        can type a fresh amount directly — other fields are untouched."""
        entry = event.widget
        current = entry.get().strip().replace(",", "").replace("₹", "")
        try:
            is_zero = float(current) == 0.0
        except ValueError:
            is_zero = False
        if is_zero:
            entry.delete(0, tk.END)

    def _refresh_matched_group_row(self, row_index):
        """Sync the cached row Series inside self.matched_groups with the
        latest values in self.df, so a redraw shows current data instead of
        the stale snapshot taken when the group was first built."""
        for group in getattr(self, "matched_groups", []):
            for i, r in enumerate(group):
                if r.name == row_index:
                    group[i] = self.df.loc[row_index].copy()
                    return

    def _on_paid_edited(self, row_index, ac, due_values, paid_entries, balance_labels, total_labels):
        """Called when a Deposited (Paid) entry is edited: recompute balance, log the deposit, then save to Excel."""
        entry = paid_entries[ac]
        raw = entry.get().strip().replace(",", "").replace("₹", "")

        prev_paid = pd.to_numeric(self.df.loc[row_index, f"{ac} paid (26-27)"], errors='coerce')
        prev_paid = 0.0 if pd.isna(prev_paid) else prev_paid

        try:
            new_paid = float(raw) if raw else 0.0
        except ValueError:
            messagebox.showerror("Invalid amount", f"Please enter a valid number for Account {ac} deposit.")
            entry.delete(0, tk.END)
            entry.insert(0, f"{prev_paid:,.2f}")
            return

        if new_paid == prev_paid:
            # Nothing actually changed (e.g. just tabbed through the field) —
            # normalize formatting only, don't log or re-save.
            entry.delete(0, tk.END)
            entry.insert(0, f"{new_paid:,.2f}")
            return

        due_value = due_values[ac]
        new_pending = due_value - new_paid

        entry.delete(0, tk.END)
        entry.insert(0, f"{new_paid:,.2f}")

        balance_labels[ac].configure(
            text=f"₹ {new_pending:,.2f}", text_color=PALETTE["danger"] if new_pending > 0 else PALETTE["success"]
        )

        # Persist this account's paid/pending back into the working dataframe
        self.df.loc[row_index, f"{ac} paid (26-27)"] = new_paid
        self.df.loc[row_index, f"{ac} pending"] = new_pending

        # Recompute this certificate's Total row and roll it up into the
        # row-level aggregate columns too
        total_due, total_paid, total_pending = self._recompute_certificate_totals(
            due_values, paid_entries, balance_labels, total_labels
        )
        self.df.loc[row_index, "Recovery OB"] = total_due
        self.df.loc[row_index, "Recovered in current year (26-27)"] = total_paid
        self.df.loc[row_index, "Recovery pending for current year"] = total_pending

        # If this certificate's outstanding balance has just reached zero
        # (and wasn't already marked), record it as fully recovered this month.
        today = datetime.date.today()
        newly_recovered = total_pending <= 0 and row_index not in self.fully_recovered_rows
        if newly_recovered:
            self.fully_recovered_rows.add(row_index)
            self.df.loc[row_index, "Fully Recovered"] = "Yes"

            fr_entry = {
                "Date": today.isoformat(),
                "Month": today.strftime("%B %Y"),
                "EST NAME": self.df.loc[row_index, "EST NAME"] if "EST NAME" in self.df.columns else "",
                "EST CODE": self.df.loc[row_index, "EST CODE"] if "EST CODE" in self.df.columns else "",
                "RRC No": self.df.loc[row_index, "RRC No"] if "RRC No" in self.df.columns else "",
                "Type": self.df.loc[row_index, "Type"] if "Type" in self.df.columns else "",
                "Period": self.df.loc[row_index, "Period"] if "Period" in self.df.columns else "",
                "Total Due": total_due,
                "Total Recovered": total_paid,
            }
            self.fully_recovered_log = pd.concat(
                [self.fully_recovered_log, pd.DataFrame([fr_entry])], ignore_index=True
            )
        elif total_pending > 0 and row_index in self.fully_recovered_rows:
            # Balance went back up (e.g. a correction) — un-mark it. The
            # earlier log entry is left in place as a historical record.
            self.fully_recovered_rows.discard(row_index)
            self.df.loc[row_index, "Fully Recovered"] = ""

        # Log this deposit (the change amount, not the running total) with
        # today's date, so a month-wise recovery report can be built from it.
        delta = new_paid - prev_paid
        log_entry = {
            "Date": today.isoformat(),
            "EST NAME": self.df.loc[row_index, "EST NAME"] if "EST NAME" in self.df.columns else "",
            "EST CODE": self.df.loc[row_index, "EST CODE"] if "EST CODE" in self.df.columns else "",
            "RRC No": self.df.loc[row_index, "RRC No"] if "RRC No" in self.df.columns else "",
            "Type": self.df.loc[row_index, "Type"] if "Type" in self.df.columns else "",
            "Account": ac,
            "Amount Deposited": delta,
            "Period": self.df.loc[row_index, "Period"] if "Period" in self.df.columns else "",
        }
        self.recovery_log = pd.concat([self.recovery_log, pd.DataFrame([log_entry])], ignore_index=True)

        self._trigger_async_save()

        if newly_recovered:
            current_label = self.matched_records_box.get()
            messagebox.showinfo(
                "Fully Recovered",
                f"🎉 {fr_entry['EST NAME']}  (RRC: {fr_entry['RRC No']}, {fr_entry['Type']})\n"
                f"has been fully recovered this month.",
            )
            # Rebuild the cards so the "Fully Recovered" badge appears now,
            # not just after the establishment is reselected. The cached
            # row must be synced first, since matched_groups holds a
            # snapshot taken before this edit.
            self._refresh_matched_group_row(row_index)
            self.display_specific_row(current_label)

    def _trigger_async_save(self):
        """Trigger an asynchronous save in a background thread so the UI updates instantly."""
        self.save_status_lbl.configure(
            text="⏳ Saving to Excel...", text_color=PALETTE["warning"]
        )
        threading.Thread(target=self._async_save_worker, daemon=True).start()

    def _async_save_worker(self):
        """Write current data back to Excel safely in a background thread."""
        with self._save_lock:
            try:
                df_copy = self.df.copy()
                recovery_log_copy = self.recovery_log.copy()
                fully_recovered_log_copy = self.fully_recovered_log.copy()

                with pd.ExcelWriter(
                    self.filepath, engine="openpyxl", mode="a", if_sheet_exists="replace"
                ) as writer:
                    df_copy.to_excel(writer, sheet_name=self.sheet_name, index=False)
                    recovery_log_copy.to_excel(writer, sheet_name=self.log_sheet_name, index=False)
                    fully_recovered_log_copy.to_excel(writer, sheet_name=self.fully_recovered_sheet_name, index=False)
                
                self.after(0, self._on_save_success)
            except Exception as e:
                self.after(0, lambda err=str(e): self._on_save_error(err))

    def _on_save_success(self):
        self.save_status_lbl.configure(
            text=f"✓ Saved to {os.path.basename(self.filepath)}", text_color=PALETTE["success"]
        )

    def _on_save_error(self, err):
        self.save_status_lbl.configure(
            text=f"⚠ Could not save changes — close the file if it's open elsewhere ({err})",
            text_color=PALETTE["danger"],
        )

    # ------------------------------------------------------------------
    # Search / filter logic
    # ------------------------------------------------------------------
    def update_search_dropdown(self, mode):
        if mode == "RRC No":
            self.current_options = self.rrc_list
        elif mode == "Est Code":
            self.current_options = self.est_code_list
        else:
            self.current_options = self.est_name_list

        self.filter_options(None)

    def populate_dropdown(self, options):
        if options:
            self.search_dropdown.configure(values=options[:150])
            self.search_var.set(options[0])
            self.on_record_select(options[0])
        else:
            self.search_dropdown.configure(values=["No matches found"])
            self.search_var.set("No matches found")
            self.clear_dashboard_data()

    def filter_options(self, event):
        query = self.filter_entry.get().strip().lower()
        if not query:
            self.populate_dropdown(self.current_options)
            return

        filtered = [opt for opt in self.current_options if query in opt.lower()]
        self.populate_dropdown(filtered)

    def _build_rrc_groups(self, df_subset):
        """
        Build ordered display groups from a matched establishment's rows:
          - one group per 7A row, paired with its linked 7Q row (same 'Period')
          - one group per 14B row, paired with its linked 7Q row (same 'Period')
          - any leftover row (e.g. an unlinked 7Q) becomes its own group,
            attached after whichever family is present, 7A taking precedence

        Each returned group is a list of one or two pandas Series that get
        displayed together (e.g. the 7A card and its 7Q card shown stacked
        in the same place, no need to pick them separately).

        7A-linked groups come before 14B-linked groups.
        """
        df_subset = df_subset.copy()
        has_period = "Period" in df_subset.columns
        used = set()
        groups_7a, groups_14b, groups_other = [], [], []

        def find_linked_7q(parent_idx):
            if not has_period:
                return None
            parent_period = df_subset.loc[parent_idx, "Period"]
            if pd.isna(parent_period):
                return None
            candidates = df_subset[(df_subset["Type"] == "7Q") & (df_subset["Period"] == parent_period)]
            candidates = candidates[~candidates.index.isin(used)]
            return candidates.index[0] if not candidates.empty else None

        for idx, row in df_subset.iterrows():
            if idx in used:
                continue
            t = row.get("Type", "")
            if t == "7A":
                used.add(idx)
                rows = [row]
                q_idx = find_linked_7q(idx)
                if q_idx is not None:
                    used.add(q_idx)
                    rows.append(df_subset.loc[q_idx])
                groups_7a.append(rows)
            elif t == "14B":
                used.add(idx)
                rows = [row]
                q_idx = find_linked_7q(idx)
                if q_idx is not None:
                    used.add(q_idx)
                    rows.append(df_subset.loc[q_idx])
                groups_14b.append(rows)

        # Leftover rows (unlinked 7Q, or any other type) become their own
        # single-row group, attached after whichever family already exists.
        for idx, row in df_subset.iterrows():
            if idx in used:
                continue
            used.add(idx)
            if groups_7a:
                groups_7a.append([row])
            elif groups_14b:
                groups_14b.append([row])
            else:
                groups_other.append([row])

        return groups_7a + groups_14b + groups_other

    def on_record_select(self, selection):
        if selection == "No matches found":
            return

        mode = self.search_mode.get()
        col_map = {"RRC No": "RRC No", "Est Code": "EST CODE", "Est Name": "EST NAME"}

        matched = self.df[self.df[col_map[mode]] == selection].copy()
        if matched.empty:
            return

        self.matched_groups = self._build_rrc_groups(matched)

        record_labels = []
        for rows in self.matched_groups:
            types = " + ".join(r.get("Type", "N/A") for r in rows)
            rrc_nos = []
            for r in rows:
                v = str(r.get("RRC No", "N/A"))
                if v not in rrc_nos:
                    rrc_nos.append(v)
            label = f"{types}  |  RRC: {', '.join(rrc_nos)}"
            period = rows[0].get("Period", None)
            if period is not None and pd.notna(period):
                label += f"  |  Period: {period}"
            record_labels.append(label)

        self.matched_records_box.configure(values=record_labels)
        self.matched_records_box.set(record_labels[0])

        self.display_specific_row(record_labels[0])

    # ------------------------------------------------------------------
    # Detail rendering
    # ------------------------------------------------------------------
    def display_specific_row(self, selection_label):
        try:
            index = self.matched_records_box.cget("values").index(selection_label)
        except ValueError:
            return

        rows = self.matched_groups[index]
        primary = rows[0]

        self.title_lbl.configure(text=f"{primary.get('EST NAME', 'N/A')}")
        self.subtitle_lbl.configure(
            text=f"Code: {primary.get('EST CODE','N/A')}   •   RRC No: {primary.get('RRC No','N/A')}   •   "
                 f"Showing: {' + '.join(r.get('Type','N/A') for r in rows)}"
        )

        rec_officer = primary.get('Recovery Officer', 'N/A')
        enf_officer = primary.get('ENFORCEMENT OFFICER', 'N/A')
        self.recovery_lbl.configure(text=f"Recovery Officer: {rec_officer}   •   Enforcement Officer: {enf_officer}")
        self.save_status_lbl.configure(text="")

        # Clear previously shown certificate cards and rebuild one per row
        # in this group, so e.g. 7A and its linked 7Q render together, each
        # with its own totals row underneath its table.
        for widget in self.tables_container.winfo_children():
            widget.destroy()

        for row in rows:
            self._build_certificate_card(self.tables_container, row)

        self.save_app_state()

    def save_app_state(self):
        """Save current workspace environment and state so the app reopens where the user left off."""
        if not getattr(self, "_initialized", False):
            return
        try:
            state = {
                "search_mode": self.search_mode.get() if hasattr(self, "search_mode") else "Est Code",
                "filter_query": self.filter_entry.get() if hasattr(self, "filter_entry") else "",
                "selected_dropdown": self.search_var.get() if hasattr(self, "search_var") else "",
                "selected_record_label": self.matched_records_box.get() if hasattr(self, "matched_records_box") else "",
                "geometry": self.geometry()
            }
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(state, f, indent=4)
        except Exception as e:
            print(f"Could not save workspace state: {e}")

    def on_app_close(self):
        """Called when closing the app window."""
        self.save_app_state()
        self.destroy()

    def restore_app_state(self):
        """Restore workspace environment (selected establishment, search query, window size) on startup."""
        try:
            if not os.path.exists(self.state_file):
                return

            with open(self.state_file, "r", encoding="utf-8") as f:
                state = json.load(f)

            if "geometry" in state and state["geometry"]:
                try:
                    self.geometry(state["geometry"])
                except Exception:
                    pass

            mode = state.get("search_mode", "Est Code")
            if mode in ["RRC No", "Est Code", "Est Name"]:
                self.search_mode.set(mode)

            filter_query = state.get("filter_query", "")
            if filter_query:
                self.filter_entry.delete(0, tk.END)
                self.filter_entry.insert(0, filter_query)

            self.update_search_dropdown(mode)

            sel_dropdown = state.get("selected_dropdown", "")
            vals = self.search_dropdown.cget("values")
            if sel_dropdown and vals and sel_dropdown in vals:
                self.search_var.set(sel_dropdown)
                self.on_record_select(sel_dropdown)

                sel_label = state.get("selected_record_label", "")
                rec_vals = self.matched_records_box.cget("values")
                if sel_label and rec_vals and sel_label in rec_vals:
                    self.matched_records_box.set(sel_label)
                    self.display_specific_row(sel_label)

        except Exception as e:
            print(f"Could not restore workspace state: {e}")
        finally:
            self._initialized = True

    def clear_dashboard_data(self):
        self.title_lbl.configure(text="Select an establishment to populate metrics")
        self.subtitle_lbl.configure(text="Establishment specific details will appear below")
        self.recovery_lbl.configure(text="Recovery Field: Not Selected")
        self.save_status_lbl.configure(text="")
        self.matched_records_box.configure(values=[])
        self.matched_records_box.set("")
        self.matched_groups = []
        for widget in self.tables_container.winfo_children():
            widget.destroy()

    def reset_ui(self):
        self.filter_entry.delete(0, tk.END)
        self.update_search_dropdown(self.search_mode.get())

    # ------------------------------------------------------------------
    # Month-wise recovery report
    # ------------------------------------------------------------------
    def show_monthly_report(self):
        if self.recovery_log.empty:
            messagebox.showinfo(
                "Monthly Recovery Report",
                "No deposits have been logged yet.\n\n"
                "This report is built from deposits you enter through this app — "
                "edit a Deposited (Paid) field on any certificate card to start "
                "building it.",
            )
            return

        log = self.recovery_log.copy()
        log["Date"] = pd.to_datetime(log["Date"], errors="coerce")
        log = log.dropna(subset=["Date"])
        if log.empty:
            messagebox.showinfo("Monthly Recovery Report", "No valid dated deposit entries found yet.")
            return

        log["Month"] = log["Date"].dt.to_period("M")

        group_cols = ["Month", "RRC No", "EST CODE", "EST NAME", "Type", "Account"]
        detail = log.groupby(group_cols, dropna=False)["Amount Deposited"].sum().reset_index()
        detail = detail.sort_values(["Month", "EST NAME", "Type", "Account"])

        win = ctk.CTkToplevel(self)
        win.title("Month-wise Recovery Report")
        win.geometry("1080x680")
        win.configure(fg_color=PALETTE["bg_main"])

        ctk.CTkLabel(
            win, text="Month-wise Recovery Report",
            font=ctk.CTkFont(family=FONT_FAMILY, size=20, weight="bold"), text_color=PALETTE["text_primary"],
        ).pack(padx=24, pady=(24, 4), anchor="w")

        ctk.CTkLabel(
            win, text="Based on deposits entered through this app",
            font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"],
        ).pack(padx=24, pady=(0, 16), anchor="w")

        table_frame = ctk.CTkScrollableFrame(win, fg_color=PALETTE["bg_card"], corner_radius=12)
        table_frame.pack(fill="both", expand=True, padx=24, pady=(0, 24))

        headers = ["Month", "RRC No", "EST Code", "EST Name", "Type", "Account", "Amount Deposited"]
        col_weights = [1, 1, 1, 2, 1, 1, 1]
        for c, (h, w) in enumerate(zip(headers, col_weights)):
            table_frame.grid_columnconfigure(c, weight=w)
            lbl = ctk.CTkLabel(
                table_frame, text=h, font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
                fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=38,
            )
            lbl.grid(row=0, column=c, sticky="nsew", padx=1, pady=1)

        grand_total = 0.0
        row_num = 0
        current_month = None
        month_subtotal = 0.0
        TYPE_ORDER = ["7A", "14B", "7Q"]
        month_type_totals = {t: 0.0 for t in TYPE_ORDER}
        grand_type_totals = {t: 0.0 for t in TYPE_ORDER}

        def draw_type_totals_row(row_num, type_totals):
            text = "   |   ".join(f"{t} Total: ₹ {type_totals.get(t, 0.0):,.2f}" for t in TYPE_ORDER)
            ctk.CTkLabel(
                table_frame, text=text, font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
                fg_color=PALETTE["bg_main"], text_color=PALETTE["accent"], height=30,
            ).grid(row=row_num, column=0, columnspan=7, sticky="nsew", padx=1, pady=(1, 4))

        def draw_subtotal_row(row_num, month_label, subtotal):
            ctk.CTkLabel(
                table_frame, text=f"{month_label} — Subtotal",
                font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
                fg_color=PALETTE["bg_card_alt"], text_color=PALETTE["text_secondary"], height=32,
            ).grid(row=row_num, column=0, columnspan=6, sticky="nsew", padx=1, pady=1)
            ctk.CTkLabel(
                table_frame, text=f"₹ {subtotal:,.2f}", font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
                fg_color=PALETTE["bg_card_alt"],
                text_color=PALETTE["success"] if subtotal >= 0 else PALETTE["danger"], height=32,
            ).grid(row=row_num, column=6, sticky="nsew", padx=1, pady=1)

        for _, rec in detail.iterrows():
            month_label = rec["Month"].strftime("%B %Y")

            if current_month is not None and month_label != current_month:
                row_num += 1
                draw_subtotal_row(row_num, current_month, month_subtotal)
                row_num += 1
                draw_type_totals_row(row_num, month_type_totals)
                month_subtotal = 0.0
                month_type_totals = {t: 0.0 for t in TYPE_ORDER}

            current_month = month_label
            amount = rec["Amount Deposited"]
            month_subtotal += amount
            grand_total += amount
            rec_type = rec["Type"]
            if rec_type in month_type_totals:
                month_type_totals[rec_type] += amount
                grand_type_totals[rec_type] += amount

            row_num += 1
            bg = PALETTE["row_even"] if row_num % 2 == 0 else PALETTE["row_odd"]
            values = (
                month_label, rec["RRC No"], rec["EST CODE"], rec["EST NAME"], rec["Type"], rec["Account"],
                f"₹ {amount:,.2f}"
            )
            for c_idx, val in enumerate(values):
                text_color = PALETTE["text_primary"]
                if c_idx == 6:
                    text_color = PALETTE["success"] if amount >= 0 else PALETTE["danger"]
                ctk.CTkLabel(
                    table_frame, text=str(val), font=ctk.CTkFont(family=FONT_FAMILY, size=12),
                    fg_color=bg, text_color=text_color, height=34,
                ).grid(row=row_num, column=c_idx, sticky="nsew", padx=1, pady=1)

        if current_month is not None:
            row_num += 1
            draw_subtotal_row(row_num, current_month, month_subtotal)
            row_num += 1
            draw_type_totals_row(row_num, month_type_totals)

        row_num += 1
        ctk.CTkLabel(
            table_frame, text="Grand Total", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=40,
        ).grid(row=row_num, column=0, columnspan=6, sticky="nsew", padx=1, pady=1)
        ctk.CTkLabel(
            table_frame, text=f"₹ {grand_total:,.2f}", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["success"] if grand_total >= 0 else PALETTE["danger"],
            height=40,
        ).grid(row=row_num, column=6, sticky="nsew", padx=1, pady=1)

        row_num += 1
        draw_type_totals_row(row_num, grand_type_totals)

    # ------------------------------------------------------------------
    # Fully-recovered report
    # ------------------------------------------------------------------
    def show_fully_recovered_report(self):
        if self.fully_recovered_log.empty:
            messagebox.showinfo(
                "Fully Recovered Report",
                "No establishments have been marked fully recovered yet.\n\n"
                "A certificate is added here automatically the moment its "
                "Outstanding Balance reaches ₹ 0.00 after you enter a deposit.",
            )
            return

        log = self.fully_recovered_log.copy()
        log["Date"] = pd.to_datetime(log["Date"], errors="coerce")
        log = log.dropna(subset=["Date"])
        if log.empty:
            messagebox.showinfo("Fully Recovered Report", "No valid dated entries found yet.")
            return

        log["MonthPeriod"] = log["Date"].dt.to_period("M")
        log = log.sort_values(["MonthPeriod", "EST NAME", "Type"])

        win = ctk.CTkToplevel(self)
        win.title("Fully Recovered Report")
        win.geometry("1000x680")
        win.configure(fg_color=PALETTE["bg_main"])

        ctk.CTkLabel(
            win, text="Fully Recovered Report",
            font=ctk.CTkFont(family=FONT_FAMILY, size=20, weight="bold"), text_color=PALETTE["text_primary"],
        ).pack(padx=24, pady=(24, 4), anchor="w")

        ctk.CTkLabel(
            win, text="Establishments whose outstanding balance reached ₹ 0.00, by the month it happened",
            font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"],
        ).pack(padx=24, pady=(0, 16), anchor="w")

        table_frame = ctk.CTkScrollableFrame(win, fg_color=PALETTE["bg_card"], corner_radius=12)
        table_frame.pack(fill="both", expand=True, padx=24, pady=(0, 24))

        headers = ["Month", "RRC No", "EST Code", "EST Name", "Type", "Total Due", "Total Recovered"]
        col_weights = [1, 1, 1, 2, 1, 1, 1]
        for c, (h, w) in enumerate(zip(headers, col_weights)):
            table_frame.grid_columnconfigure(c, weight=w)
            lbl = ctk.CTkLabel(
                table_frame, text=h, font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
                fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=38,
            )
            lbl.grid(row=0, column=c, sticky="nsew", padx=1, pady=1)

        row_num = 0
        current_month = None
        month_count = 0
        grand_count = 0

        def draw_month_header(row_num, month_label, count):
            ctk.CTkLabel(
                table_frame, text=f"{month_label} — {count} establishment(s) fully recovered",
                font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
                fg_color=PALETTE["bg_card_alt"], text_color=PALETTE["success"], height=32,
            ).grid(row=row_num, column=0, columnspan=7, sticky="nsew", padx=1, pady=(8, 1))

        for _, rec in log.iterrows():
            month_label = rec["MonthPeriod"].strftime("%B %Y")

            if month_label != current_month:
                current_month = month_label
                month_count = 0
                row_num += 1
                draw_month_header(row_num, month_label, (log["MonthPeriod"] == rec["MonthPeriod"]).sum())

            month_count += 1
            grand_count += 1

            row_num += 1
            bg = PALETTE["row_even"] if row_num % 2 == 0 else PALETTE["row_odd"]
            values = (
                month_label, rec["RRC No"], rec["EST CODE"], rec["EST NAME"], rec["Type"],
                f"₹ {rec['Total Due']:,.2f}", f"₹ {rec['Total Recovered']:,.2f}",
            )
            for c_idx, val in enumerate(values):
                ctk.CTkLabel(
                    table_frame, text=str(val), font=ctk.CTkFont(family=FONT_FAMILY, size=12),
                    fg_color=bg, text_color=PALETTE["text_primary"], height=34,
                ).grid(row=row_num, column=c_idx, sticky="nsew", padx=1, pady=1)

        row_num += 1
        ctk.CTkLabel(
            table_frame, text=f"Grand Total — {grand_count} establishment(s) fully recovered",
            font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            fg_color=PALETTE["accent_soft"], text_color=PALETTE["success"], height=40,
        ).grid(row=row_num, column=0, columnspan=7, sticky="nsew", padx=1, pady=1)

    # ------------------------------------------------------------------
    # Account Payment History & Add Deposit Dialog
    # ------------------------------------------------------------------
    def show_account_payment_history(self, row_index, ac, due_values, paid_entries, balance_labels, total_labels):
        """Show date-wise payment history and allow adding partial payments for a specific account."""
        row = self.df.loc[row_index]
        est_name = str(row.get("EST NAME", "N/A"))
        est_code = str(row.get("EST CODE", "N/A"))
        rrc_no = str(row.get("RRC No", "N/A"))
        rrc_type = str(row.get("Type", "N/A"))
        period = str(row.get("Period", "N/A"))

        win = ctk.CTkToplevel(self)
        win.title(f"Account {ac} Payment History — {est_name}")
        win.geometry("820x620")
        win.configure(fg_color=PALETTE["bg_main"])
        win.grab_set()

        # Title Block
        ctk.CTkLabel(
            win, text=f"Account {ac} Payment History",
            font=ctk.CTkFont(family=FONT_FAMILY, size=20, weight="bold"), text_color=PALETTE["text_primary"],
        ).pack(padx=24, pady=(20, 2), anchor="w")

        ctk.CTkLabel(
            win, text=f"{est_name} ({est_code})  •  RRC No: {rrc_no}  •  Type: {rrc_type}  •  Period: {period}",
            font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"],
        ).pack(padx=24, pady=(0, 14), anchor="w")

        # Summary Frame
        summary_frame = ctk.CTkFrame(win, fg_color=PALETTE["bg_card"], corner_radius=12)
        summary_frame.pack(fill="x", padx=24, pady=(0, 16))

        due_lbl = ctk.CTkLabel(summary_frame, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"), text_color=PALETTE["text_primary"])
        due_lbl.pack(side="left", expand=True, pady=12)

        paid_lbl = ctk.CTkLabel(summary_frame, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"), text_color=PALETTE["accent"])
        paid_lbl.pack(side="left", expand=True, pady=12)

        bal_lbl = ctk.CTkLabel(summary_frame, text="", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"), text_color=PALETTE["danger"])
        bal_lbl.pack(side="left", expand=True, pady=12)

        # Add Payment Section
        add_frame = ctk.CTkFrame(win, fg_color=PALETTE["bg_card"], corner_radius=12)
        add_frame.pack(fill="x", padx=24, pady=(0, 16))

        ctk.CTkLabel(
            add_frame, text="➕ Add Partial Payment", font=ctk.CTkFont(family=FONT_FAMILY, size=13, weight="bold"),
            text_color=PALETTE["text_primary"]
        ).pack(padx=16, pady=(12, 6), anchor="w")

        form_frame = ctk.CTkFrame(add_frame, fg_color="transparent")
        form_frame.pack(fill="x", padx=16, pady=(0, 12))

        ctk.CTkLabel(form_frame, text="Date (YYYY-MM-DD):", font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"]).pack(side="left", padx=(0, 6))
        
        date_frame_pop = ctk.CTkFrame(form_frame, fg_color="transparent")
        date_frame_pop.pack(side="left", padx=(0, 16))

        date_entry = ctk.CTkEntry(date_frame_pop, width=110, height=32, font=ctk.CTkFont(family=FONT_FAMILY, size=12))
        date_entry.insert(0, datetime.date.today().isoformat())
        date_entry.pack(side="left")

        picker_btn_pop = ctk.CTkButton(
            date_frame_pop, text="📅", width=32, height=32, fg_color=PALETTE["accent_soft"],
            hover_color=PALETTE["accent"], text_color=PALETTE["text_primary"], corner_radius=6,
            font=ctk.CTkFont(size=12),
            command=lambda: CTkDatePicker(win, date_entry)
        )
        picker_btn_pop.pack(side="left", padx=(4, 0))

        ctk.CTkLabel(form_frame, text="Amount (₹):", font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"]).pack(side="left", padx=(0, 6))
        amt_entry = ctk.CTkEntry(form_frame, width=140, height=32, font=ctk.CTkFont(family=FONT_FAMILY, size=12), placeholder_text="e.g. 5000", justify="right")
        amt_entry.pack(side="left", padx=(0, 16))

        # History Table Container
        table_container = ctk.CTkScrollableFrame(win, fg_color=PALETTE["bg_card"], corner_radius=12)
        table_container.pack(fill="both", expand=True, padx=24, pady=(0, 20))

        def refresh_history():
            current_due = due_values[ac]
            current_paid = pd.to_numeric(self.df.loc[row_index, f"{ac} paid (26-27)"], errors='coerce')
            current_paid = 0.0 if pd.isna(current_paid) else current_paid
            current_bal = current_due - current_paid

            due_lbl.configure(text=f"Dues OB: ₹ {current_due:,.2f}")
            paid_lbl.configure(text=f"Total Deposited: ₹ {current_paid:,.2f}")
            bal_lbl.configure(
                text=f"Outstanding Balance: ₹ {current_bal:,.2f}",
                text_color=PALETTE["danger"] if current_bal > 0 else PALETTE["success"]
            )

            for widget in table_container.winfo_children():
                widget.destroy()

            headers = ["Payment Date", "Account", "Payment Amount (₹)", "Period"]
            for c, h in enumerate(headers):
                table_container.grid_columnconfigure(c, weight=1)
                ctk.CTkLabel(
                    table_container, text=h, font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
                    fg_color=PALETTE["accent_soft"], text_color=PALETTE["text_primary"], height=32,
                ).grid(row=0, column=c, sticky="nsew", padx=1, pady=1)

            mask = (
                (self.recovery_log["RRC No"].astype(str).str.strip() == rrc_no) &
                (self.recovery_log["Account"].astype(str).str.strip() == str(ac))
            )
            filtered_logs = self.recovery_log[mask].copy()

            if filtered_logs.empty:
                ctk.CTkLabel(
                    table_container, text="No date-wise payment entries logged yet for this account.",
                    font=ctk.CTkFont(family=FONT_FAMILY, size=12), text_color=PALETTE["text_secondary"], height=40
                ).grid(row=1, column=0, columnspan=4, pady=10)
            else:
                for idx, (_, rec) in enumerate(filtered_logs.iterrows(), start=1):
                    bg = PALETTE["row_even"] if idx % 2 == 0 else PALETTE["row_odd"]
                    dt_str = str(rec.get("Date", "N/A"))[:10]
                    deposit_amt = pd.to_numeric(rec.get("Amount Deposited", 0), errors='coerce')
                    deposit_amt = 0.0 if pd.isna(deposit_amt) else deposit_amt
                    per_str = str(rec.get("Period", "N/A"))

                    ctk.CTkLabel(table_container, text=dt_str, fg_color=bg, text_color=PALETTE["text_primary"], height=30).grid(row=idx, column=0, sticky="nsew", padx=1, pady=1)
                    ctk.CTkLabel(table_container, text=f"Account {ac}", fg_color=bg, text_color=PALETTE["text_primary"], height=30).grid(row=idx, column=1, sticky="nsew", padx=1, pady=1)
                    ctk.CTkLabel(table_container, text=f"₹ {deposit_amt:,.2f}", fg_color=bg, text_color=PALETTE["success"], height=30, anchor="e").grid(row=idx, column=2, sticky="nsew", padx=1, pady=1)
                    ctk.CTkLabel(table_container, text=per_str, fg_color=bg, text_color=PALETTE["text_primary"], height=30).grid(row=idx, column=3, sticky="nsew", padx=1, pady=1)

        def submit_new_payment():
            p_date = date_entry.get().strip()
            raw_amt = amt_entry.get().strip().replace(",", "").replace("₹", "")
            try:
                amt = float(raw_amt)
                if amt <= 0:
                    raise ValueError("Amount must be greater than zero.")
            except ValueError:
                messagebox.showerror("Invalid Input", "Please enter a valid positive payment amount.", parent=win)
                return

            try:
                datetime.date.fromisoformat(p_date)
            except ValueError:
                messagebox.showerror("Invalid Date", "Please enter a valid date in YYYY-MM-DD format.", parent=win)
                return

            prev_paid = pd.to_numeric(self.df.loc[row_index, f"{ac} paid (26-27)"], errors='coerce')
            prev_paid = 0.0 if pd.isna(prev_paid) else prev_paid
            new_paid = prev_paid + amt
            due_value = due_values[ac]
            new_pending = due_value - new_paid

            self.df.loc[row_index, f"{ac} paid (26-27)"] = new_paid
            self.df.loc[row_index, f"{ac} pending"] = new_pending

            log_entry = {
                "Date": p_date,
                "EST NAME": est_name,
                "EST CODE": est_code,
                "RRC No": rrc_no,
                "Type": rrc_type,
                "Account": ac,
                "Amount Deposited": amt,
                "Period": period,
            }
            self.recovery_log = pd.concat([self.recovery_log, pd.DataFrame([log_entry])], ignore_index=True)

            paid_entries[ac].delete(0, tk.END)
            paid_entries[ac].insert(0, f"{new_paid:,.2f}")
            balance_labels[ac].configure(
                text=f"₹ {new_pending:,.2f}",
                text_color=PALETTE["danger"] if new_pending > 0 else PALETTE["success"]
            )

            self._recompute_certificate_totals(due_values, paid_entries, balance_labels, total_labels)
            self._trigger_async_save()

            amt_entry.delete(0, tk.END)
            refresh_history()
            messagebox.showinfo("Payment Recorded", f"Successfully recorded payment of ₹ {amt:,.2f} on {p_date}.", parent=win)

        add_btn = ctk.CTkButton(
            form_frame, text="➕ Add Payment", font=ctk.CTkFont(family=FONT_FAMILY, size=12, weight="bold"),
            fg_color=PALETTE["accent"], hover_color=PALETTE["accent_hover"], height=32,
            command=submit_new_payment
        )
        add_btn.pack(side="left")

        refresh_history()


if __name__ == "__main__":
    filename = "RRC UPTO DATE 1.xlsx"
    app = RRCManagerApp(filename)
    app.mainloop()