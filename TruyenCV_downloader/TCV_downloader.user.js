// ==UserScript==
// @name         TruyenCV downloader v2
// @namespace    https://nntoan.com/
// @description  Tải truyện từ truyencv.com định dạng epub.
// @version      1.0.0
// @icon         http://i.imgur.com/o5cmtkU.png
// @author       Toan Nguyen
// @oujs:author  nntoan
// @license      MIT; https://nntoan.mit-license.org/
// @supportURL   https://github.com/nntoan/UserScripts/issues
// @match        http://truyencv.com/*
// @match        https://truyencv.com/*
// @require      https://unpkg.com/jszip@3.2.1/dist/jszip.min.js
// @require      https://unpkg.com/ejs@2.6.1/ejs.min.js
// @require      https://unpkg.com/jepub@2.1.0/dist/jepub.min.js
// @require      https://unpkg.com/file-saver@2.0.2/dist/FileSaver.min.js
// @require      https://cdn.jsdelivr.net/gh/nntoan/mbDownloader@0.2.3/src/mbDownloader.min.js
// @connect      self
// @run-at       document-idle
// @noframes
// ==/UserScript==
/*global console, location*/
(function ($, window, document) { // eslint-disable-line
    'use strict';

    $(document).ready(function() {
        $.widget('nntoan.mbDownloader', $.nntoan.mbDownloader, {
            _create: function () {
                var self = this;
                this._super();

                // Extending options
                this.options.processing.ebookFileName = this.options.general.pathname.slice(12);
                this.options.xhr.chapter.data = $.extend(this.options.xhr.chapter.data, {
                    story_id: self.elements.$novelId.val()
                });
                this.options.xhr.content.url = this.options.general.pathname + this.options.chapters.chapId + '/';
                this.elements.$downloadBtn.css('margin-top', '10px');

                console.time('downloadAndGenerateEpub');
            }
        });

        $(this).mbDownloader({
            readyToInit: true,
            processing: {
                ebookFileExt: '.epub'
            },
            classNames: {
                novelId: '#story_id_hidden',
                infoBlock: '.truyencv-detail-info-block',
                chapterContent: '.box-chap:not(.hidden)',
                chapterNotContent: 'iframe, script, style, a, div, p:has(a[href*="truyen.tangthuvien.vn"])',
                chapterVip: '#btnChapterVip',
                chapterTitle: 'h2',
                ebookTitle: 'h1',
                ebookAuthor: '.author',
                ebookCover: '.img-responsive',
                ebookDesc: '.brief',
                ebookType: '.categories a',
                downloadBtnStatus: 'btn-primary btn-success btn-info btn-warning btn-danger blue success warning info danger error',
                downloadAppendTo: '.info .buttons',
            },
            ebook: {
                fallbackCover: 'https://truyen.tangthuvien.vn/images/default-book.png'
            },
            chapters: {
                chapListSlice: [6, -1],
            },
            xhr: {
                chapter: {
                    type: 'GET',
                    url: '/story/chapters',
                },
                content: {
                    type: 'GET',
                    xhrFields: {
                        withCredentials: true
                    }
                }
            },
            bookInfoUpdated: function (event, data) {
                console.log('Book information updated...', data.epubInfo);
            },
            chapTitleUpdated: function(event, data) {
                console.log('Chapter: ' + data.chapNum + ' downloaded...');
            },
            beforeCreateEpub: function(event, that) {
                console.log('Prepare generate epub...');
            },
            complete: function(event, that) {
                console.log('Epub downloaded successfully. Please check your Downloads folder.');
                console.timeEnd('downloadAndGenerateEpub');
            }
        });
    });
})(jQuery, window, document); // eslint-disable-line
