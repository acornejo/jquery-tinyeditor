(function() {

function fileToDataURL(fileInfo, fn) {
  var reader = new FileReader();
  reader.onload = function (e) { fn(null, e.target.result); };
  reader.onerror = function (e) { fn(e); };
  reader.readAsDataURL(fileInfo);
}

function factory($) {
  var pluginName = 'tinyeditor';

  $.fn[pluginName] = function (userOptions) {
    var editor = this,
      selectedRange,
      options = $.extend({}, $.fn[pluginName].defaultOptions, userOptions),
      toolbarBtnSelector = 'a[data-' + options.commandRole + '],button[data-' + options.commandRole + '],input[type=button][data-' + options.commandRole + ']',
      updateToolbar = function () {
        if (options.activeToolbarClass) {
          $(options.toolbarSelector).find(toolbarBtnSelector).each(function () {
            var command = $(this).data(options.commandRole);
            if (document.queryCommandState(command))
              $(this).addClass(options.activeToolbarClass);
            else
              $(this).removeClass(options.activeToolbarClass);
          });
        }
      },
      execCommand = function (commandWithArgs, valueArg) {
        var commandArr = commandWithArgs.split(' '),
          command = commandArr.shift(),
          args = commandArr.join(' ') + (valueArg || '');
        if (command === 'chooseFile')
          chooseFile(args);
        else {
          document.execCommand(command, 0, args);
          updateToolbar();
        }
      },
      bindHotkeys = function () {
        $.each(options.hotKeys, function (hotkey, command) {
          editor.keydown(hotkey, function (e) {
            if (editor.attr('contenteditable') && editor.is(':visible')) {
              e.preventDefault();
              e.stopPropagation();
              execCommand(command);
            }
          }).keyup(hotkey, function (e) {
            if (editor.attr('contenteditable') && editor.is(':visible')) {
              e.preventDefault();
              e.stopPropagation();
            }
          });
        });
      },
      getCurrentRange = function () {
        var sel = window.getSelection();
        if (sel.getRangeAt && sel.rangeCount)
          return sel.getRangeAt(0);
      },
      saveSelection = function () {
        selectedRange = getCurrentRange();
      },
      restoreSelection = function () {
        var selection = window.getSelection();
        if (selectedRange) {
          try {
            selection.removeAllRanges();
          } catch (ex) {
            document.body.createTextRange().select();
            document.selection.empty();
          }

          selection.addRange(selectedRange);
        }
      },
      chooseFile = function (accept) {
        var form = document.createElement('form');
        var input = document.createElement('input');
        input.type = 'file';
        input.name = 'file';
        if (accept)
          input.accept = accept;
        input.onchange = function () {
          restoreSelection();
          if (this.type === 'file' && this.files && this.files.length > 0)
            insertFiles(this.files);
          saveSelection();
          this.value = '';
        };
        input.click();
      },
      insertFiles = function (files) {
        editor.focus();
        $.each(files, function (idx, fileInfo) {
          if (/^image\//.test(fileInfo.type)) {
            fileToDataURL(fileInfo, function (e, url) {
              if (e || !url) return options.fileUploadError('file-reader', e);
              execCommand('insertimage', url);
            });
          } else
            options.fileUploadError("unsupported-file-type", fileInfo.type);
        });
      },
      markSelection = function (input, color) {
        restoreSelection();
        if (document.queryCommandSupported('hiliteColor'))
          document.execCommand('hiliteColor', 0, color || 'transparent');
        saveSelection();
        input.data(options.selectionMarker, color);
      },
      bindToolbar = function () {
        var toolbar = $(options.toolbarSelector);
        toolbar.find(toolbarBtnSelector).click(function () {
          restoreSelection();
          editor.focus();
          execCommand($(this).data(options.commandRole));
          saveSelection();
        });
        toolbar.find('[data-toggle=dropdown]').click(restoreSelection);

        toolbar.find('input[type=text][data-' + options.commandRole + ']').on('webkitspeechchange change', function () {
          var newValue = this.value; /* ugly but prevents fake double-calls due to selection restoration */
          this.value = '';
          restoreSelection();
          if (newValue) {
            editor.focus();
            execCommand($(this).data(options.commandRole), newValue);
          }
          saveSelection();
          $(this).parent('.input-group').parent('.dropdown-menu').siblings('.dropdown-toggle').dropdown('toggle');
        }).on('focus', function () {
          var input = $(this);
          if (!input.data(options.selectionMarker)) {
            markSelection(input, options.selectionColor);
            input.focus();
          }
        }).on('blur', function () {
          var input = $(this);
          if (input.data(options.selectionMarker)) {
            markSelection(input, false);
          }
        }).on('click', function () {
          return false;
        }).keydown('esc', function () {
          this.value = '';
          $(this).change();
        });
      },
      bindDragAndDropImages = function () {
        editor.on('dragenter dragover', false)
          .on('drop', function (e) {
            var dataTransfer = e.originalEvent.dataTransfer;
            e.stopPropagation();
            e.preventDefault();
            if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0)
              insertFiles(dataTransfer.files);
          });
      };
      bindToolTips = function () {
        $(options.toolbarSelector).find('a[title]').tooltip({container: 'body'});
      };
    bindToolbar();
    if (options.enableHotKeys)
      bindHotkeys();
    if (options.enableDragAndDropImages)
      bindDragAndDropImages();
    if (options.enableToolTips)
      bindToolTips();
    editor.attr('contenteditable', true)
      .on('mouseup keyup mouseout', function () {
        saveSelection();
        updateToolbar();
      });
      try {
        document.execCommand("styleWithCSS", 0, false);
      } catch (e) {
        try {
          document.execCommand("useCSS", 0, true);
        } catch (e) {
          try {
            document.execCommand('styleWithCSS', false, false);
          }
          catch (e) { }
        }
      }
    $(window).bind('touchend', function (e) {
      var isInside = (editor.is(e.target) || editor.has(e.target).length > 0),
        currentRange = getCurrentRange(),
        clear = currentRange && (currentRange.startContainer === currentRange.endContainer && currentRange.startOffset === currentRange.endOffset);
      if (!clear || isInside) {
        saveSelection();
        updateToolbar();
      }
    });
    return editor;
  };

  $.fn[pluginName].defaultOptions = {
    hotKeys: {
      'ctrl+b meta+b': 'bold',
      'ctrl+i meta+i': 'italic',
      'ctrl+z meta+z': 'undo',
      'ctrl+y meta+y meta+shift+z': 'redo',
      'shift+tab': 'outdent',
      'tab': 'indent'
    },
    toolbarSelector: '[data-role=editor-toolbar]',
    commandRole: 'edit',
    activeToolbarClass: 'btn-info',
    selectionMarker: 'edit-focus-marker',
    selectionColor: 'darkgrey',
    enableDragAndDropImages: true,
    enableHotKeys: true,
    enableToolTips: true,
    fileUploadError: function (reason, detail) {
      console.log("File upload error", reason, detail);
    }
  };
}

if (typeof require === "function" && typeof exports === "object" && typeof module === "object")
  factory(require("jquery"));
else if (typeof define === "function" && define.amd)
  define(["jquery"], factory);
else
  factory(window.jQuery);

})();
