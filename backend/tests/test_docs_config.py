from app.config import Settings


def test_api_docs_enabled_only_in_local_or_debug():
    assert Settings(app_env="local", debug=False, enable_api_docs=True).api_docs_enabled is True
    assert Settings(app_env="sandbox", debug=True, enable_api_docs=True).api_docs_enabled is True
    assert Settings(app_env="sandbox", debug=False, enable_api_docs=True).api_docs_enabled is False
    assert Settings(app_env="local", debug=False, enable_api_docs=False).api_docs_enabled is False
