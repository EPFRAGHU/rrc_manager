import os
import streamlit as st
import pandas as pd
from datetime import datetime

st.set_page_config(page_title="EPFO ECR Dashboard", page_icon="🧾", layout="wide")

# Custom CSS for beauty
st.markdown("""
<style>
    .main-header {font-size: 2.5rem; color: #1E3A8A; text-align: center; margin-bottom: 0;}
    .sub-header {color: #3B82F6; font-weight: 600;}
    .stDataFrame {border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);}
    .metric-card {background: linear-gradient(90deg, #EFF6FF, #DBEAFE); padding: 15px; border-radius: 10px;}
</style>
""", unsafe_allow_html=True)

st.markdown('<h1 class="main-header">🧾 EPFO Office 360 - ECR Dashboard</h1>', unsafe_allow_html=True)
st.markdown("**Monthly ECR Amounts (Apr–Mar) • FY 2024 & FY 2025**")

def find_file(filename):
    if os.path.exists(filename):
        return filename
    parent_path = os.path.join("..", filename)
    if os.path.exists(parent_path):
        return parent_path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    parent_script_dir = os.path.dirname(script_dir)
    candidate = os.path.join(parent_script_dir, filename)
    if os.path.exists(candidate):
        return candidate
    return filename

@st.cache_data
def load_data():
    y24 = pd.read_csv(find_file("downloadecr-download-fy_data_360_Y24.csv"), low_memory=False)
    y25 = pd.read_csv(find_file("downloadecr-download-fy_data_360_Y25.csv"), low_memory=False)
    master = pd.read_csv(find_file("downloadest-master-download_data_360_AL_04-03-1952_04-07-2026_0_9999999_0_0_0_0_0_0_0_0_0_0_0_LST_OFC.csv"), low_memory=False)
    for df in [y24, y25, master]:
        df['EST_ID'] = df['EST_ID'].astype(str).str.strip()
    return y24, y25, master

y24, y25, master = load_data()

# Sidebar Filters
with st.sidebar:
    st.header("🔍 Filters")
    search = st.text_input("Search EST_ID or Establishment Name", placeholder="e.g., MAPSYS or ORBBS...")
    
    # Industry filter (if available)
    if 'IND_GROUP_NAME' in master.columns:
        industries = ["All"] + sorted(master['IND_GROUP_NAME'].dropna().unique())
        industry_filter = st.selectbox("Industry Group", industries)
    
    # Status filter
    status_filter = st.selectbox("Establishment Status", ["All", "Live", "Closed"])

# Filter master data
filtered_master = master.copy()
if search:
    filtered_master = filtered_master[
        filtered_master['EST_ID'].str.contains(search, case=False, na=False) |
        filtered_master['EST_NAME'].str.contains(search, case=False, na=False)
    ]
if 'industry_filter' in locals() and industry_filter != "All":
    filtered_master = filtered_master[filtered_master['IND_GROUP_NAME'] == industry_filter]

est_options = filtered_master[['EST_ID', 'EST_NAME']].drop_duplicates()
selected_id = st.selectbox(
    "Select Establishment",
    options=est_options['EST_ID'],
    format_func=lambda x: f"{x} — {est_options[est_options['EST_ID']==x]['EST_NAME'].iloc[0]}"
)

if selected_id:
    est_data24 = y24[y24['EST_ID'] == selected_id]
    est_data25 = y25[y25['EST_ID'] == selected_id]
    est_info = master[master['EST_ID'] == selected_id].iloc[0] if not master[master['EST_ID'] == selected_id].empty else None
    
    # Header Info
    col1, col2 = st.columns([3, 1])
    with col1:
        st.subheader(f"**{est_info['EST_NAME'] if est_info is not None else 'Unknown'}**")
        st.caption(f"EST ID: `{selected_id}`")
    with col2:
        if est_info is not None:
            st.metric("Coverage Date", est_info.get('COVER_DATE', 'N/A'))
    
    tab1, tab2, tab3 = st.tabs(["📋 Monthly Table", "📈 Trends", "ℹ️ Establishment Info"])
    
    with tab1:
        months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
        
        # Column names
        amt_cols24 = ['APR_23_AMT','MAY_23_AMT','JUN_23_AMT','JUL_23_AMT','AUG_23_AMT','SEP_23_AMT',
                     'OCT_23_AMT','NOV_23_AMT','DEC_23_AMT','JAN_24_AMT','FEB_24_AMT','MAR_24_AMT']
        amt_cols25 = ['APR_24_AMT','MAY_24_AMT','JUN_24_AMT','JUL_24_AMT','AUG_24_AMT','SEP_24_AMT',
                     'OCT_24_AMT','NOV_24_AMT','DEC_24_AMT','JAN_25_AMT','FEB_25_AMT','MAR_25_AMT']
        
        row24 = est_data24.iloc[0] if not est_data24.empty else pd.Series()
        row25 = est_data25.iloc[0] if not est_data25.empty else pd.Series()
        
        data = {
            'Month': months,
            'FY 2024 Amount (₹)': [row24.get(col, 0) for col in amt_cols24],
            'FY 2025 Amount (₹)': [row25.get(col, 0) for col in amt_cols25]
        }
        
        df = pd.DataFrame(data)
        
        # Styled table
        st.dataframe(
            df.style.format({"FY 2024 Amount (₹)": "{:,.0f}", "FY 2025 Amount (₹)": "{:,.0f}"})
                   .background_gradient(cmap='Blues', subset=['FY 2024 Amount (₹)', 'FY 2025 Amount (₹)']),
            use_container_width=True,
            hide_index=True
        )
        
        total24 = df['FY 2024 Amount (₹)'].sum()
        total25 = df['FY 2025 Amount (₹)'].sum()
        
        c1, c2, c3 = st.columns(3)
        c1.metric("**Total FY 2024**", f"₹{total24:,.0f}", delta=None)
        c2.metric("**Total FY 2025**", f"₹{total25:,.0f}", delta=f"{((total25/total24)-1)*100:.1f}%" if total24 > 0 else None)
        c3.metric("**YoY Change**", f"₹{total25 - total24:,.0f}")
        
        csv = df.to_csv(index=False).encode('utf-8')
        st.download_button("📥 Download Table as CSV", csv, f"ECR_{selected_id}.csv", "text/csv")
    
    with tab2:
        st.line_chart(df.set_index('Month'), use_container_width=True, height=500)
        st.bar_chart(df.set_index('Month'), use_container_width=True)
    
    with tab3:
        if est_info is not None:
            st.json({
                "PAN": est_info.get('PAN'),
                "Address": f"{est_info.get('INCROP_ADDRESS1', '')} {est_info.get('INCROP_ADDRESS2', '')}".strip(),
                "City/District": f"{est_info.get('INCROP_CITY')} - {est_info.get('INCROP_DIST')}",
                "Status": est_info.get('EST_STATUS_NAME'),
                "Type": est_info.get('EST_TYPE_NAME')
            })
        else:
            st.info("Master data details not available.")
else:
    st.info("👈 Search and select an establishment from the sidebar to begin.")

st.caption(f"Last updated: {datetime.now().strftime('%d %b %Y')}")