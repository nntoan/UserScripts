// ==UserScript==
// @name         MB Downloader Library
// @namespace    https://github.com/nntoan/UserScripts
// @version      0.1.5
// @description  Tải truyện từ các trang đọc truyện phổ biến dưới định dạng epub.
// @icon         https://i.imgur.com/1Wyz9je.jpg
// @author       Toan Nguyen
// @license      MIT; https://nntoan.mit-license.org/
// @exclude      *
// @require      https://cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/jquery-ui@1.12.1/ui/widget.min.js
// @require      https://unpkg.com/jepub@1.2.5/dist/jepub.min.js
// @require      https://unpkg.com/file-saver@2.0.1/dist/FileSaver.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_deleteValue
// @grant        GM_listValues
// @run-at       document-idle
// @connect      self
// @noframes
// ==/UserScript==

/*jshint evil:true newcap:false*/
/*global GM_getValue, GM_setValue, GM_xmlhttpRequest, GM_registerMenuCommand, GM_deleteValue, GM_listValues, console, location, jEpub, saveAs*/
(function($, window, document) {
    'use strict';

    $.widget('nntoan.mbDownloader', {
        jepub: null,
        processing: {
            count: 0,
            begin: '',
            end: '',
            endDownload: false,
            beginEnd: '',
            titleError: [],
            chapListSize: 0,
        },
        elements: {
            $window: $(window),
            $downloadBtn: $('<a>', {
                class: 'btn blue btn-download',
                href: 'javascript:;',
                text: 'Tải xuống'
            }),
            $novelId: null,
            $infoBlock: null,
        },
        options: {
            errorAlert: true,
            credits: '<p>UserScript được viết bởi: <a href="https://nntoan.com/">Toan Nguyen</a></p>',
            general: {
                host: location.host,
                pathname: location.pathname,
                referrer: location.protocol + '//',
                pageName: document.title,
            },
            processing: {
                ebookFileName: null,
                ebookFileExt: '.epub',
                documentTitle: '[...] Vui lòng chờ trong giây lát',
            },
            regularExp: {
                chapter: ['\s*Chương\s*\d+\s?:.*[^<\n]', 'g'],
                novel: ['\s*Tiểu\s*thuyết\s?:.*[^<\n]', 'g'],
                chineseSpecialChars: ['[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]+', 'gm'],
                alphanumeric: ['\s[a-zA-Z0-9]{6,8}(="")?\s', 'gm'],
                alphabet: ['[A-Z]'],
                number: ['\d+'],
                buttons: ['\([^(]+<button[^/]+<\/button>[^)]*\)\s*', 'gi'],
                eoctext: ['(ps:|hoan nghênh quảng đại bạn đọc quang lâm|Huyền ảo khoái trí ân cừu)', 'i'],
                breakline: ['\n', 'g'],
                chapList: ['(?:href=")[^")]+(?=")', 'g'],
            },
            classNames: {
                novelId: null,
                infoBlock: null,
                chapterContent: null,
                chapterNotContent: null,
                chapterVip: '#btnChapterVip',
                ebookTitle: null,
                ebookAuthor: null,
                ebookCover: null,
                ebookDesc: null,
                ebookType: null,
                downloadBtnStatus: 'btn-primary btn-success btn-info btn-warning btn-danger blue success warning info danger error',
                downloadAppendTo: null,
            },
            ebook: {
                title: null,
                author: null,
                publisher: location.host,
                description: null,
                tags: [],
            },
            chapters: {
                chapList: [],
                chapListSlice: [6, -1],
                chapId: null,
                chapTitle: null,
            },
            xhr: {
                chapter: {
                    type: 'GET',
                    url: null,
                    data: {},
                },
                content: {
                    type: 'GET',
                    url: null,
                    xhrFields: {
                        withCredentials: true
                    }
                }
            }
        },

        _create: function () {
            // Register core elements
            this.elements.$novelId = $(this.options.classNames.novelId);
            this.elements.$infoBlock = $(this.options.classNames.infoBlock);

            if (!this.elements.$novelId.length || !this.elements.$infoBlock.length) {
                return;
            }

            // Works with options
            this.options.general.referrer = this.options.general.referrer + this.options.general.host + this.options.general.pathname;
            this.options.xhr.content.url = this.options.general.pathname + this.options.chapters.chapId + '/';

            // Prepare & register jEpub instance
            this.getBookInfo();
            this.jepub = new jEpub(this.options.ebook).uuid(this.generateUUID());

            // Works with download button
            this.elements.$downloadBtn.appendTo(this.options.classNames.downloadAppendTo);
            this.registerEventHandlers(this.elements.$downloadBtn, 'dl');
        },

        getBookInfo: function () {
            var options = this.options;

            options.ebook.title = this.elements.$infoBlock.find(options.classNames.ebookTitle).text().trim();
            options.ebook.author = this.elements.$infoBlock.find(options.classNames.ebookAuthor).find('p').text().trim();
            options.ebook.cover = this.elements.$infoBlock.find(options.classNames.ebookCover).find('img').attr('src');
            options.ebook.description = this.elements.$infoBlock.find(options.classNames.ebookDesc).html();
            var $ebookType = this.elements.$infoBlock.find(options.classNames.ebookType);
            if ($ebookType.length) {
                $ebookType.each(function () {
                    options.ebook.tags.push($(this).text().trim());
                });
            }
        },

        createRegExp: function (regExp) {
            if (!regExp.length) {
                return;
            }

            return new RegExp(regExp[0], regExp[1]);
        },

        registerEventHandlers: function ($widget, typeFn) {
            var self = this,
                options = this.options;

            if (typeFn === 'dl') {
                $widget.one('click contextmenu', function (e) {
                    e.preventDefault();

                    document.title = options.processing.documentTitle;

                    $.ajax(options.xhr.chapter).done(function (response) {
                        options.chapters.chapList = response.match(self.createRegExp(options.regularExp.chapList));
                        options.chapters.chapList = options.chapters.chapList.map(self.chapListValueFilter);

                        if (e.type === 'contextmenu') {
                            $widget.off('click');
                            var startFrom = prompt('Nhập ID chương truyện bắt đầu tải:', options.chapters.chapList[0]);
                            startFrom = options.chapters.chapList.indexOf(startFrom);
                            if (startFrom !== -1) {
                                options.chapters.chapList = options.chapters.chapList.slice(startFrom);
                            }
                        } else {
                            $widget.off('contextmenu');
                        }

                        self.processing.chapListSize = options.chapters.chapList.length;
                        if (self.processing.chapListSize > 0) {
                            self.elements.$window.on('beforeunload', function () {
                                return 'Truyện đang được tải xuống...';
                            });

                            $widget.one('click', function (e) {
                                e.preventDefault();
                                self.saveEbook();
                            });

                            self.getContent($widget);
                        }
                    }).fail(function (error) {
                        $widget.text('Lỗi danh mục');
                        self.downloadStatus('error');
                        console.error(error);
                    });
                });
            }
        },

        getContent: function ($widget) {
            var self = this,
                options = this.options;

            if (self.processing.endDownload === true) {
                return;
            }

            options.chapters.chapId = options.chapters.chapList[self.processing.count];

            $.ajax(options.xhr.content).done(function (response) {
                var $data = $(response),
                    $chapter = $data.find(options.classNames.chapterContent),
                    $notContent = $chapter.find(options.classNames.chapterNotContent),
                    $referrer = $chapter.find('[style]').filter(function () {
                        return (this.style.fontSize === '1px' || this.style.fontSize === '0px' || this.style.color === 'white');
                    }),
                    chapContent;

                if (self.processing.endDownload === true) {
                    return;
                }

                options.chapters.chapTitle = $data.find('h2').text().trim();
                if (options.chapters.chapTitle === '') {
                    options.chapters.chapTitle = 'Chương ' + options.chapters.chapId.match(self.createRegExp(options.regularExp.number))[0];
                }

                if (!$chapter.length) {
                    chapContent = self.downloadError('Không có nội dung');
                } else {
                    if ($chapter.find(options.classNames.chapterVip).length) {
                        chapContent = self.downloadError('Chương VIP');
                    } else if ($chapter.filter(function () {
                        return (this.textContent.toLowerCase().indexOf('vui lòng đăng nhập để đọc chương này') !== -1);
                    }).length) {
                        chapContent = self.downloadError('Chương yêu cầu đăng nhập');
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
                            chapContent = self.downloadError('Nội dung không có');
                        } else {
                            if (!$widget.hasClass('error')) {
                                self.downloadStatus('warning');
                            }
                            chapContent = self.parseHtml($chapter.html());
                        }
                    }
                }

                self.jepub.add(options.chapters.chapTitle, chapContent);

                if (self.processing.count === 0) {
                    self.processing.begin = options.chapters.chapTitle;
                }
                self.processing.end = options.chapters.chapTitle;

                $widget.html('Đang tải: ' + Math.floor((self.processing.count / self.processing.chapListSize) * 100) + '%');

                self.processing.count++;
                document.title = '[' + self.processing.count + '] ' + options.general.pageName;
                if (self.processing.count >= self.processing.chapListSize) {
                    self.saveEbook($widget);
                } else {
                    self.getContent($widget);
                }
            }).fail(function (error) {
                self.downloadError('Kết nối không ổn định', error);
                self.saveEbook($widget);
            });
        },

        chapListValueFilter: function (val) {
            var options = this.options;

            val = val.slice(options.chapters.chapListSlice[0], options.chapters.chapListSlice[1]);
            val = val.replace(options.general.referrer, '');

            return val.trim();
        },

        downloadStatus: function (status) {
            var self = this,
                options = this.options;

            self.elements.$downloadBtn.removeClass(options.classNames.downloadBtnStatus).addClass('btn-' + status).addClass(status);
        },

        downloadError: function (error, message) {
            var options = this.options;

            this.downloadStatus('error');
            this.processing.titleError.push(options.chapters.chapTitle);
            if (options.errorAlert) {
                options.errorAlert = confirm('Lỗi! ' + message + '\nBạn có muốn tiếp tục nhận cảnh báo?');
            }

            if (error) {
                console.error(message);
            }

            return '<p class="no-indent"><a href="' + options.general.referrer + options.chapters.chapId + '">' + message + '</a></p>';
        },

        parseHtml: function (html) {
            var options = this.options;

            html = html.replace(this.createRegExp(options.regularExp.chapter), '');
            html = html.replace(this.createRegExp(options.regularExp.novel), '');
            html = html.replace(this.createRegExp(options.regularExp.chineseSpecialChars), ''); // eslint-disable-line
            html = html.replace(this.createRegExp(options.regularExp.alphanumeric), function (key, attr) {
                if (attr) return ' ';
                if (!isNaN(key)) return key;
                if (key.split(this.createRegExp(options.regularExp.alphabet)).length > 2) return ' ';
                if (key.split(this.createRegExp(options.regularExp.number)).length > 1) return ' ';
                return key;
            });
            html = html.replace(this.createRegExp(options.regularExp.buttons), '');
            html = html.split(this.createRegExp(options.regularExp.eoctext))[0];
            html = html.replace(this.createRegExp(options.regularExp.breakline), '<br />');
            return '<div>' + html + '</div>';
        },

        saveEbook: function ($widget) {
            var self = this,
                options = this.options;

            if (self.processing.endDownload) {
                return;
            }

            self.processing.endDownload = true;
            $widget.html('Đang nén EPUB...');

            if (options.chapters.chapTitle.length) {
                self.processing.titleError = '<p class="no-indent"><strong>Các chương lỗi: </strong>' + self.processing.titleError.join(', ') + '</p>';
            } else {
                self.processing.titleError = '';
            }
            self.processing.beginEnd = '<p class="no-indent">Nội dung từ <strong>' + self.processing.begin + '</strong> đến <strong>' + self.processing.end + '</strong></p>';

            self.jepub.notes(self.processing.beginEnd + self.processing.titleError + '<br /><br />' + options.credits);

            self.jepub.generate().then(self.afterGenerateEpub).catch(function (error) {
                self.downloadStatus('error');
                console.error(error);
            });
        },

        afterGenerateEpub: function (epubZipContent) {
            var self = this,
                options = this.options,
                ebookFilepath = options.processing.ebookFilename + options.processing.ebookFileExt;

            document.title = '[⇓] ' + options.ebook.title;
            self.elements.$window.off('beforeunload');

            self.elements.$downloadBtn.attr({
                href: window.URL.createObjectURL(epubZipContent),
                download: ebookFilepath
            }).text('✓ Hoàn thành').off('click');
            if (!self.elements.$downloadBtn.hasClass('error')) {
                self.downloadStatus('success');
            }

            saveAs(epubZipContent, ebookFilepath);
        },

        generateUUID : function () {
            // Universally Unique Identifier
            var d = new Date().getTime();
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = (d + Math.random() * 16) % 16 | 0;
                d = Math.floor(d / 16);
                return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
            });

            return uuid;
        },
    });

    return $.nntoan.mbDownloader;
})(jQuery, window, document);
