// ==UserScript==
// @name         TruyenFull downloader
// @namespace    https://nntoan.com/
// @description  Tải truyện từ truyenfull.vn định dạng epub
// @version      1.0.0
// @icon         http://i.imgur.com/3lomxTC.png
// @author       Toan Nguyen
// @oujs:author  nntoan
// @license      MIT; https://nntoan.mit-license.org/
// @supportURL   https://github.com/nntoan/UserScripts/issues
// @match        http://truyenfull.vn/*
// @match        https://truyenfull.vn/*
// @require      https://unpkg.com/jszip@3.2.1/dist/jszip.min.js
// @require      https://unpkg.com/ejs@2.6.1/ejs.min.js
// @require      https://unpkg.com/jepub@2.1.0/dist/jepub.min.js
// @require      https://unpkg.com/file-saver@2.0.2/dist/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/gh/nntoan/mbDownloader@0.2.4/src/mbDownloader.min.js
// @connect      self
// @run-at       document-idle
// @noframes
// ==/UserScript==
/*global console, location*/
(function ($, window, document) {
    'use strict';

    $(document).ready(function () {
        $.widget('nntoan.mbDownloader', $.nntoan.mbDownloader, {
            _create: function () {
                this._super();

                // Extending options
                this.options.processing.ebookFileName = this.options.general.pathname.slice(1, -1);
                this.options.xhr.chapter.data = $.extend(this.options.xhr.chapter.data, {
                    type: 'chapter_option',
                    data: self.elements.$novelId.val(),
                    bnum: '',
                    num: 1,
                    hash: '',
                });
                this.options.xhr.content.url = this.options.general.pathname + this.options.chapters.chapId + '/';

                console.time('downloadAndGenerateEpub');
            },

            /**
             * Update CSS of download button.
             *
             * @param {String} status Download status
             * @returns void
             */
            downloadStatus: function (status) {
                this._super(status);
                this.elements.$downloadBtn.css({ 'background': '#e05d59', 'color': '#ffffff !important', 'border-color': '#c83e35' });
            },

            /**
             * Callback function to handle chap list values.
             *
             * @param {Object} options
             * @param {String} val
             * @returns {String}
             */
            chapListValueFilter: function (options, val) {
                val = this._super(options, val);
                val = val.replace(location.protocol + '//' + location.host, '');
                if (val.indexOf(location.pathname) === -1) {
                    val = '';
                }

                if (val === location.pathname) {
                    val = '';
                }

                return val.trim();
            },
        });

        $(this).mbDownloader({
            readyToInit: true,
            processing: {
                ebookFileExt: '.epub'
            },
            regularExp: {
                chapter: null
            },
            classNames: {
                novelId: '#truyen-id',
                infoBlock: '.node-truyen',
                chapterContent: '#noidung',
                chapterNotContent: 'iframe, script, style, a, div, p:has(a[href*="bachngocsach.com"])',
                chapterVip: '#btnChapterVip',
                chapterList: '#chuong-list-more',
                chapterTitle: 'h1#chuong-title',
                ebookTitle: 'h1#truyen-title',
                ebookAuthor: '.info a[itemprop="author"]',
                ebookCover: '.books img',
                ebookDesc: '.desc-text',
                ebookType: 'div#theloai a',
                downloadBtnStatus: 'btn-primary btn-success btn-info btn-warning btn-danger blue success warning info danger error',
                downloadAppendTo: 'nav#truyen-nav:last',
            },
            ebook: {
                corsAnywhere: '',
                fallbackCover: 'https://bachngocsach.com/reader/sites/default/files/logo.png'
            },
            chapters: {
                chapListSlice: [7],
            },
            xhr: {
                chapter: {
                    type: 'GET',
                    url: '/ajax.php',
                },
                hash: {
                    type: 'GET',
                    url: '/ajax.php',
                    data: {
                        type: 'hash'
                    }
                },
                content: {
                    type: 'GET',
                    xhrFields: {
                        withCredentials: true
                    }
                }
            },
            bookInfoUpdated: function (event, data) {
                var that = data.that,
                    options = that.options,
                    $infoBlock = that.elements.$infoBlock;

                options.ebook = $.extend(options.ebook, {
                    title: $infoBlock.find(options.classNames.ebookTitle).text().trim(),
                    author: $infoBlock.find(options.classNames.ebookAuthor).text().trim(),
                    cover: $infoBlock.find(options.classNames.ebookCover).find('img').attr('src'),
                    description: $infoBlock.find(options.classNames.ebookDesc).html(),
                });

                data.epubInfo = $.extend(data.epubInfo, options.ebook);

                console.log('Book information updated...', data.epubInfo);
            },
            getListOfChaptersPreprocess: function (event, that) {
                return $.when($.ajax(that.options.xhr.hash));
            },
            chapIdUpdated: function (event, that) {
                var options = that.options;
                options.xhr.content.url = location.protocol + '//' + options.general.host + options.chapters.chapId;
            },
            beforeCreateEpub: function (event, that) {
                console.log('Prepare generate epub...');
            },
            complete: function (event, that) {
                console.log('Epub downloaded successfully. Please check your Downloads folder.');
                console.timeEnd('downloadAndGenerateEpub');
            }
        });
    });
})(jQuery, window, document); // eslint-disable-line
