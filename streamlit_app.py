"""Entry point for Streamlit deployments.

Streamlit's deploy UI expects a single .py file path in the repo. Importing
`launcher_web` runs the Streamlit app defined there. This small wrapper also
applies secrets from `st.secrets` into environment variables expected by the
app (e.g. `NEON_DB_URL`, `ADMIN_SECRET`).
"""
import os

try:
    import streamlit as st
    # Copy relevant secrets (if present) into env so other modules can read them
    try:
        if hasattr(st, 'secrets') and isinstance(st.secrets, dict):
            if 'NEON_DB_URL' in st.secrets and 'NEON_DB_URL' not in os.environ:
                os.environ['NEON_DB_URL'] = st.secrets['NEON_DB_URL']
            if 'ADMIN_SECRET' in st.secrets and 'ADMIN_SECRET' not in os.environ:
                os.environ['ADMIN_SECRET'] = st.secrets['ADMIN_SECRET']
    except Exception:
        # Best-effort only
        pass
except Exception:
    # Running outside Streamlit (e.g., local lint/test); continue anyway
    pass

# Import the web launcher (it executes the Streamlit app at module scope)
try:
    import launcher_web  # noqa: F401
except Exception as e:
    # If import fails, show a helpful message when running Streamlit
    try:
        import streamlit as st
        st.error(f"Error importing launcher_web: {e}")
    except Exception:
        raise
