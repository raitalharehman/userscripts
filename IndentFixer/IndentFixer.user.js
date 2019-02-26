// ==UserScript==
// @name         Indentation fixer
// @namespace    https://github.com/LunarWatcher/userscripts
// @version      0.0.0.3
// @description  A userscript that theoretically should fix formatting.
// @author       Olivia Zoe
// @include      /^https?:\/\/\w*.?(stackoverflow|stackexchange|serverfault|superuser|askubuntu|stackapps)\.com\/(questions|posts|review|tools)\/(?!tagged\/|new\/).*/
// @grant        none
// @downloadURL  https://github.com/LunarWatcher/userscripts/raw/IndentFixer-Dev/IndentFixer/IndentFixer.user.js
// @updateURL    https://github.com/LunarWatcher/userscripts/raw/IndentFixer-Dev/IndentFixer/IndentFixer.user.js
// ==/UserScript==


const BUTTON_ID = "clean_indents";

const baseIndent = "    ";
const listIndent = "        ";

(function() {
    'use strict';
    try {
        StackExchange.using('inlineEditing', function() {
            StackExchange.ready(function() {
                var test = window.location.href.match(/.posts.(\d+).edit/);
                if(test) {
                    init($('form[action^="/posts/' + test[1] + '"]'), test[1]);
                }
                $('#post-form').each(function(){
                    let currForm = $(this);
                    console.log(currForm);
                    init(currForm, currForm[0][0].getAttribute("value"));
                });
            });
        });
        $(document).ajaxComplete(function() {
            var test = arguments[2].url.match(/posts.(\d+).edit-inline/);
            if(!test) {
                test = arguments[2].url.match(/review.inline-edit-post/);
                if(!test) return;
                test = arguments[2].data.match(/id=(\d+)/);
                if(!test) return;
            }
            StackExchange.ready(function() {
                init($('form[action^="/posts/' + test[1] + '"]'), test[1]);
            });
        });
    }catch(e) {
        console.log("Failed to launch the script");
        console.log(e);
    }
})();

function init(editorRoot, id){
    console.log("Initializing editor.");
    console.log(id);
    const button = createButton(id);
    $(button).appendTo(editorRoot);
    $("#" + BUTTON_ID + "_" + id).click(fixIndents);

}

function fixIndents() {
    console.log("Clicked");
    let button = $(this);
    if(button == null) {
        console.log("Null button?!");
    }

    let id = button.attr("id");
    let postId = id.match(/_(\d+)/)[1];
    if(postId == null) {
        console.log("Couldn't find the post ID from the button ID. Dumping button");
        console.log(button);
        return;
    }

    let inputField = $("#wmd-input-" + postId)[0];
    if(inputField == null) {
        console.log("Couldn't grab the input field!");
        return;
    }

    let text = inputField.defaultValue;

    // Now this is where stuff gets interesting.
    // First: let's get the lines.
    let lines = text.split("\n");

    // Define the output String
    let reconstructed = "";
    // Keep track of the current states:
    let persistent = {
        tokens: []
    };

     // Iterate the lines
    for(let i = 0; i < lines.length; i++) {
        let line = lines[i];
        getData(persistent, line);

        reconstructed += appendLine(persistent, persistent.line);

    }

    console.log(reconstructed);

}

function appendLine(persistent, lineToAppend) {
    if(lineToAppend == "" || !persistent.codeBlock) {
         return lineToAppend + "\n";
    }
    if(lineToAppend.startsWith("```") || lineToAppend.startsWith("    ```")) {
         if(persistent.list) return "    ```\n"; else return "```\n";

    }
    // Okay, now it gets tricky x_x
    // First of all, is this specific line HTML?
    let regex = /<[a-zA-Z0-9\-_ \/]+>/gm;

    let pre = persistent.tokens.length;
    if(!/^\s*(?:#|\/\/|\s*\*|\/\*\*)/.test(lineToAppend)
            && regex.test(lineToAppend)) {
        // Yeah yeah, parsing HTML with Regex. Fight me.
        // Some of the regex code has been generated by https://regex101.com/codegen?language=javascript
        let m;
        let construct = "";
        while((m = regex.exec(lineToAppend)) !== null) {
            if(m.index === regex.lastIndex) regex.lastIndex++;
            m.forEach((match, groupIndex) => {
                if(match.contains("hr") || match.contains("br")) {
                    // forEach is annoying af xd can't use `continue`
                } else {
                    if(match.contains("/")){
                        let pLen = persistent.tokens.length - 1;
                        console.log(persistent.tokens);
                        if(pLen + 1 > 0 && persistent.tokens[pLen <= 0 ? 0 : pLen].replace(/<>\//, "") == match.replace(/<>\//, "")) {
                            persistent.tokens.pop();
                        } else persistent.tokens.push(match);
                    }
                }
            });
        }
    }
    for(let i = 0; i < lineToAppend.length; i++) {
        let char = lineToAppend[i];
        let flipped = flip(char);
        if(flipped != null) {
            if(persistent.tokens.length == 0) persistent.tokens.push(char);
            else {
                if(persistent.tokens[persistent.tokens.length - 1] == flipped) persistent.tokens.pop();
                else persistent.tokens.push(char);
            }
        }
    }
    let post = persistent.tokens.length;
    let level = 0;
    if(pre <= post) level = pre;
    else level = post;

    let indents = getIndents(persistent.list, level, getBaseIndent(persistent.spaced));
    console.log(indents);
    let line = lineToAppend.trim().replace(/^\s+/, "");
    if(persistent.quote) indents = "> " + indents;
    let u = indents + line + "\n";
    console.log(indents.length);
    return u;
}

function getData(persistent, line) {
    let trimmedLine = line.trim();
    let formattedLine = line;
    if(!persistent.comment && formattedLine.startsWith("> ")) {
        persistent.quote = true;
        formattedLine = formattedLine.substring(2);
    }
    persistent.line = formattedLine;
    if(line == "") {
        persistent.hadNewline = true;
        // Newlines are incredibly easy to handle: simply move on.
        return;
    } else {
        // newlines break most formatting unless it's indented with four spaces.
        // Which means quotes, lists, and code blocks (except spaced ones) break.
        if(!line.startsWith("    ") && persistent.hadNewline) {
            
            persistent.list = false;
            persistent.quote = false;

            if(persistent.codeBlock && persistent.spaced){
                persistent.codeBlock = false;
                persistent.tokens = [];
            }
        }
        persistent.hadNewline = false;
    }


    if(trimmedLine.startsWith("<!--") && !trimmedLine.contains("-->")) persistent.comment = true;
    if(trimmedLine.contains("-->")) persistent.comment = false;
    // Check if we have a list.
    if(!persistent.codeBlock && !persistent.list && (trimmedLine.startsWith("-") || trimmedLine.startsWith("*") || /^\\d+\./.test(trimmedLine))) {
        persistent.list == true;
    }
    if(line.startsWith("---") || line.startsWith("<!--")){
        persistent.list = false;
        if(persistent.spaced){
            persistent.codeBlock = false;
            persistent.tokens = [];
        }
    }

    if(!persistent.comment) {
        if(!persistent.codeBlock && ((!persistent.list && line.startsWith(baseIndent)) || line.startsWith(listIndent))) {
            persistent.codeBlock = true;
            persistent.spaced = true;
        } else if(persistent.codeBlock && persistent.spaced && ((!persistent.list && !line.startsWith(baseIndent)) || !line.startsWith(listIndent))) {
            persistent.codeBlock = false;
            persistent.tokens = [];
        } else if(!persistent.codeBlock && line.contains("```")){
            if((!persistent.list && line.startsWith("```")) || (persistent.list && line.startsWith("    ```"))){
                persistent.codeBlock = true;
                persistent.spaced = false;
            } else if(persistent.list && line.startsWith("```")){
                persistent.codeBlock = true;
                persistent.spaced = false;
                persistent.list = false;
            } else throw new Error("Failed to parse line: " + formattedLine);
        } else if(persistent.codeBlock && line.startsWith("```")) {
            persistent.tokens = [];
            persistent.codeBlock = false;
        }
    }

}

function getBaseIndent(spaced) {
    if(!spaced) return ""; else return baseIndent;
}

function getIndents(isList, level, baseIndent) {
    let base;
    if(isList) base = baseIndent + baseIndent; else base = baseIndent;
    if(level == 0) return base;
    else {
        for(let i = 0; i < level; i++) {
            base += baseIndent;
        }
        return base;
    }
}

function flip(char) {
    if(char == "{") return "}";
    if(char == "(") return ")";
    if(char == "[") return "]";
    if(char == "}") return "{";
    if(char == ")") return "(";
    if(char == "]") return "[";
    return null;
}

function createButton(id) {
    return "<a href=\"javascript:void(0);\" id='" + BUTTON_ID + "_" + id + "' class='grid--cell s-btn'>Clean up indentation</a>";
}
