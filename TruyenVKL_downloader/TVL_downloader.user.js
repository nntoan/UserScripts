// ==UserScript==
// @name         TruyenVKL downloader
// @namespace    https://nntoan.com/
// @description  Tải truyện từ truyenvkl.com định dạng epub
// @version      1.0.0
// @icon         https://i.imgur.com/zCwfI3b.png
// @author       Toan Nguyen
// @oujs:author  nntoan
// @license      MIT; https://nntoan.mit-license.org/
// @supportURL   https://github.com/nntoan/UserScripts/issues
// @match        http://truyenvkl.com/*
// @match        https://truyenvkl.com/*
// @require      https://unpkg.com/jszip@3.2.1/dist/jszip.min.js
// @require      https://unpkg.com/ejs@2.6.1/ejs.min.js
// @require      https://unpkg.com/jepub@2.1.0/dist/jepub.min.js
// @require      https://unpkg.com/file-saver@2.0.2/dist/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js
// @require      https://cdn.jsdelivr.net/gh/nntoan/mbDownloader@0.2.3/src/mbDownloader.min.js
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
                this.options.xhr.chapter.url = $(this.options.classNames.chapterList).attr('href');
                this.options.xhr.chapter.data = $.extend(this.options.xhr.chapter.data, {
                    action: 'load_data'
                });
                this.options.xhr.content.url = this.options.general.pathname + this.options.chapters.chapId + '/';

                // Styling download button for current site
                $(this.options.classNames.downloadAppendTo).after(this.elements.$downloadBtn);
                this.elements.$downloadBtn.attr('class', 'btn border-btn download-btn');

                console.time('downloadAndGenerateEpub');
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
                infoBlock: '.detail-left',
                chapterContent: '#bookContent',
                chapterNotContent: 'iframe, script, style, a, div, p:has(a[href*="bachngocsach.com"])',
                chapterVip: '#btnChapterVip',
                chapterList: '.lb.btns > a',
                chapterTitle: 'h2.bookHeading',
                ebookTitle: 'h1.bookname',
                ebookAuthor: 'p.author',
                ebookCover: '.cover.img img',
                ebookDesc: '#gioithieu .article-cont',
                ebookType: 'p.tags a',
                downloadBtnStatus: 'btn-primary btn-success btn-info btn-warning btn-danger blue success warning info danger error',
                downloadAppendTo: '.lb.btns > .follow-btn',
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
                    type: 'POST',
                    url: '',
                    dataType: 'json'
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
