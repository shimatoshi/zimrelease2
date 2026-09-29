# zimrelease2

HTMLを `content/<slug>.html` にpushするとGitHub Actionsが検索対応ZIMへ変換し、同名tagのGitHub Releaseへ自動公開します。

ルートの `index.html` はVercel配布UIです。GitHub Releases APIからZIM一覧を取得し、ブラウザからダウンロードできます。
