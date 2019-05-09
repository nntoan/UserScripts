// ==UserScript==
// @name         TangThuVien downloader
// @namespace    https://nntoan.com/
// @description  Tải truyện từ truyen.tangthuvien.vn định dạng epub
// @version      1.0.0
// @icon         https://i.imgur.com/rt1QT6z.png
// @author       Toan Nguyen
// @oujs:author  nntoan
// @license      MIT; https://nntoan.mit-license.org/
// @match        http://truyen.tangthuvien.vn/doc-truyen/*
// @match        https://truyen.tangthuvien.vn/doc-truyen/*
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      https://unpkg.com/jepub@1.2.5/dist/jepub.min.js
// @require      https://unpkg.com/file-saver@2.0.1/dist/FileSaver.min.js
// @noframes
// @connect      self
// @supportURL   https://github.com/nntoan/UserScripts/issues
// @run-at       document-idle
// @grant        none
// ==/UserScript==
(function ($, window, document) {
    'use strict';

    /**
     * Nhận cảnh báo khi có chương bị lỗi
     */
    var errorAlert = true;

    /**
     * Những đoạn ghi chú cuối chương của converter
     * Chỉ cần ghi phần bắt đầu, không phân biệt hoa thường
     * Ngăn cách các đoạn bằng dấu |
     */
    var converter = 'ps:|hoan nghênh quảng đại bạn đọc quang lâm|Huyền ảo khoái trí ân cừu';


    converter = new RegExp('(' + converter + ')', 'i');

    function cleanHtml(str) {
        str = str.replace(/\s*Chương\s*\d+\s?:[^<\n]/, '');
        str = str.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]+/gm, ''); // eslint-disable-line
        str = str.replace(/\s[a-zA-Z0-9]{6,8}(="")?\s/gm, function (key, attr) {
            if (attr) return ' ';
            if (!isNaN(key)) return key;
            if (key.split(/[A-Z]/).length > 2) return ' ';
            if (key.split(/\d/).length > 1) return ' ';
            return key;
        });
        str = str.replace(/\([^(]+<button[^/]+<\/button>[^)]*\)\s*/gi, '');
        str = str.split(converter)[0];
        return '<div>' + str + '</div>';
    }

    function downloadError(mess, err) {
        downloadStatus('error');
        titleError.push(chapTitle);
        if (errorAlert) {
            errorAlert = confirm('Lỗi! ' + mess + '\nBạn có muốn tiếp tục nhận cảnh báo?');
        }

        if (err) {
            console.error(mess);
        }
        return '<p class="no-indent"><a href="' + referrer + chapId + '">' + mess + '</a></p>';
    }

    function saveEbook() {
        if (endDownload) return;
        endDownload = true;
        $download.html('Đang nén EPUB');

        if (titleError.length) {
            titleError = '<p class="no-indent"><strong>Các chương lỗi: </strong>' + titleError.join(', ') + '</p>';
        } else {
            titleError = '';
        }
        beginEnd = '<p class="no-indent">Nội dung từ <strong>' + begin + '</strong> đến <strong>' + end + '</strong></p>';

        jepub.notes(beginEnd + titleError + '<br /><br />' + credits);

        jepub.generate().then(function (epubZipContent) {
            document.title = '[⇓] ' + ebookTitle;
            $win.off('beforeunload');

            $download.attr({
                href: window.URL.createObjectURL(epubZipContent),
                download: ebookFilename
            }).text('Hoàn thành').off('click');
            if (!$download.hasClass('error')) downloadStatus('success');

            saveAs(epubZipContent, ebookFilename);  // eslint-disable-line
        }).catch(function (err) {
            downloadStatus('error');
            console.error(err);
        });
    }

    function getContent() {
        if (endDownload) {
            return;
        }
        chapId = chapList[count];

        $.ajax({
            url: pathname + chapId + '/',
            xhrFields: {
                withCredentials: true
            }
        }).done(function (response) {
            var $data = $(response),
                $chapter = $data.find('.box-chap:not(.hidden)'),
                $notContent = $chapter.find('iframe, script, style, a, div, p:has(a[href*="truyen.tangthuvien.vn"])'),
                $referrer = $chapter.find('[style]').filter(function () {
                    return (this.style.fontSize === '1px' || this.style.fontSize === '0px' || this.style.color === 'white');
                }),
                chapContent;

            if (endDownload) return;

            chapTitle = $data.find('h2').text().trim();
            if (chapTitle === '') chapTitle = 'Chương ' + chapId.match(/\d+/)[0];

            if (!$chapter.length) {
                chapContent = downloadError('Không có nội dung');
            } else {
                if ($chapter.find('#btnChapterVip').length) {
                    chapContent = downloadError('Chương VIP');
                } else if ($chapter.filter(function () {
                    return (this.textContent.toLowerCase().indexOf('vui lòng đăng nhập để đọc chương này') !== -1);
                }).length) {
                    chapContent = downloadError('Chương yêu cầu đăng nhập');
                } else {
                    var $img = $chapter.find('img');
                    if ($img.length) {
                        $img.replaceWith(function () {
                            return '<br /><a href="' + this.src + '">Click để xem ảnh</a><br />';
                        });
                    }

                    if ($notContent.length) $notContent.remove();
                    if ($referrer.length) $referrer.remove();

                    if ($chapter.text().trim() === '') {
                        chapContent = downloadError('Nội dung không có');
                    } else {
                        if (!$download.hasClass('error')) downloadStatus('warning');
                        chapContent = cleanHtml($chapter.html());
                    }
                }
            }

            jepub.add(chapTitle, chapContent);

            if (count === 0) begin = chapTitle;
            end = chapTitle;

            $download.html('Đang tải: ' + Math.floor((count / chapListSize) * 100) + '%');

            count++;
            document.title = '[' + count + '] ' + pageName;
            if (count >= chapListSize) {
                saveEbook();
            } else {
                getContent();
            }
        }).fail(function (err) {
            downloadError('Kết nối không ổn định', err);
            saveEbook();
        });
    }


    var pageName = document.title,
        $win = $(window),
        $download = $('<a>', {
            class: 'btn blue btn-download',
            href: '#download',
            text: 'Tải xuống'
        }),
        downloadStatus = function (status) {
            $download.removeClass('btn-primary btn-success btn-info btn-warning btn-danger blue success warning info danger error').addClass('btn-' + status).addClass(status);
        },

        $novelId = $('#story_id_hidden'),
        $chapterUuid = $('.middle-box li.active'),
        chapList = [],
        chapListSize = 0,
        chapId = '',
        chapTitle = '',
        count = 0,
        begin = '',
        end = '',
        endDownload = false,

        ebookTitle = '',
        ebookAuthor = '',
        ebookCover = '',
        ebookDesc = '',
        ebookType = [],
        beginEnd = '',
        titleError = [],

        host = location.host,
        pathname = location.pathname,
        referrer = location.protocol + '//' + host + pathname,

        ebookFilename = pathname.slice(1, -1) + '.epub',

        credits = '<p>Truyện được tải từ <a href="' + referrer + '">TangThuVien</a></p><p>Userscript được viết bởi: <a href="https://nntoan.com/">Toan Nguyen</a></p>',

        jepub;


    if (!$novelId.length) return;

    var $infoBlock = $('.book-detail-wrap');

    ebookTitle = $infoBlock.find('h1').text().trim();
    ebookAuthor = $infoBlock.find('#authorId').find('p').text().trim();
    ebookCover = $infoBlock.find('#bookImg').find('img').attr('src');
    ebookDesc = $infoBlock.find('.book-intro').text().trim();

    var $ebookType = $infoBlock.find('.tag-wrap a');
    if ($ebookType.length) {
        $ebookType.each(function () {
            ebookType.push($(this).text().trim());
        });
    }

    jepub = new jEpub({  // eslint-disable-line
        title: ebookTitle,
        author: ebookAuthor,
        publisher: host,
        description: ebookDesc,
        tags: ebookType
    }).uuid(referrer);

    $download.appendTo('.take-wrap');
    $download.one('click contextmenu', function (e) {
        e.preventDefault();

        document.title = '[...] Vui lòng chờ trong giây lát';

        $.ajax({
            type: 'GET',
            url: '/story/chapters',
            data: {
                story_id: $novelId.val()
            }
        }).done(function (response) {
            chapList = response.match(/(?:href=")[^")]+(?=")/g);
            chapList = chapList.map(function (val) {
                val = val.slice(6, -1);
                val = val.replace(referrer, '');
                return val.trim();
            });

            if (e.type === 'contextmenu') {
                $download.off('click');
                var startFrom = prompt('Nhập ID chương truyện bắt đầu tải:', chapList[0]);
                startFrom = chapList.indexOf(startFrom);
                if (startFrom !== -1) chapList = chapList.slice(startFrom);
            } else {
                $download.off('contextmenu');
            }

            chapListSize = chapList.length;
            if (chapListSize > 0) {
                $win.on('beforeunload', function () {
                    return 'Truyện đang được tải xuống...';
                });

                $download.one('click', function (e) {
                    e.preventDefault();
                    saveEbook();
                });

                getContent();
            }
        }).fail(function (err) {
            $download.text('Lỗi danh mục');
            downloadStatus('error');
            console.error(err);
        });
    });

})(jQuery, window, document);  // eslint-disable-line
