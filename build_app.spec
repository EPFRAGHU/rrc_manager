# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['rrc_manager.py'],
    pathex=[],
    binaries=[],
    datas=[('C:\\Users\\Dell\\anaconda3\\Lib\\site-packages\\customtkinter', 'customtkinter')],
    hiddenimports=['openpyxl', 'pandas', 'PIL', 'PIL.Image', 'customtkinter'],
    excludes=[
        'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'scipy', 'matplotlib', 'sphinx',
        'docutils', 'pytest', 'IPython', 'notebook', 'bokeh', 'dask', 'h5py',
        'sqlalchemy', 'botocore', 'boto3', 'lxml', 'tables', 'zmq', 'nbformat',
        'jsonschema', 'argon2', 'keyring', 'ruamel'
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='RRC_Manager',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='RRC_Manager',
)
