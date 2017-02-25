(function() {

	function waitFor(varName, callback) {
		var timer = window.setInterval(function() {
			if (window[varName]) {
				window.clearInterval(timer);
				callback();
			}
		}, 250);
	}

	function waitForJquery(callback) {
		waitFor("$", callback);
	}

	function waitForHljs(callback) {
		waitFor("hljs", callback);
	}

	function loadCss(url) {
		var e = document.createElement("link");
		e.rel = "stylesheet";
		e.type = "text/css";
		e.href = url;
		document.getElementsByTagName("head")[0].appendChild(e);
	}

	function applySyntaxHighlighting() {
		waitForHljs(function() {
			hljs.initHighlighting();
			var list = document.getElementsByTagName("pre");
			for (var i = 0; i < list.length; i++) {
				var pre = list[i];
				if (pre.className.indexOf("prettyprint") != -1)
					window.hljs.highlightBlock(pre);
			}
		});
	}

	function rewriteLinksToHttps() {
		waitForJquery(function() {
			var links = $("a[href*='http://blog.georgovassilis.com'").each(
					function(index, link) {
						link=$(link);
						var href = "" + link.attr("href");
						href = href.replace("http://", "https://");
						link.attr("href", href);
					});
		});
	}
	function htmlEncode(value) {
		return $('<div/>').text(value).html();
	}

	// from here: http://www.quirksmode.org/dom/getElementsByTagNames.html

	function createTOC() {
		waitForJquery(function() {
			var toc = $("#innertoc");
			var chapters = $('main article').find('h1,h2,h3,h4,h5');
			if (chapters.length < 2)
				return false;

			chapters.each(function(i, chapter){
				chapter=$(chapter);
				var headerId = chapter.id || 'link' + i;
				var li = $("<li><a class='toclink h" + chapter.nodeName
						+ "' href='#" + headerId + "'>" + htmlEncode(chapter.text())
						+ "</a></li>");
				chapter.before($("<a name='"+headerId+"'></a>"));
				toc.append(li);
			});
			return toc;
		});
	}

	loadCss("//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css");
	loadCss("https://fonts.googleapis.com/css?family=Pangolin|Lato|Monserrat");
	applySyntaxHighlighting();
	rewriteLinksToHttps();
	createTOC();
})();

function loadLatestPosts() {
	var s = document.createElement("script");
	s
			.setAttribute(
					"src",
					"https://blog.georgovassilis.com/feeds/posts/default?orderby=published&alt=json-in-script&callback=renderLatestPosts");
	document.getElementsByTagName("head")[0].appendChild(s);
}

function renderLatestPosts(v) {
	waitForJquery(function(){
	var entries = v.feed.entry;
	var count = entries.length < 5 ? entries.length : 5;
	var s = "";
	function findLink(post) {
		for (var i = 0; i < post.link.length; i++)
			if (post.link[i].rel == "alternate")
				return post.link[i];
	}
	function formatDate(date) {
		return "<time> | "
				+ (date.getDate() < 10 ? "0" : "")
				+ date.getDate()
				+ " "
				+ ([ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
						"Sep", "Oct", "Nov", "Dec" ][date.getMonth()]) + " "
				+ (1900 + date.getYear()) + "</time>";
	}

	for (var i = 0; i < count; i++) {
		var post = entries[i];
		var link = findLink(post);
		var thumbnail = "<div class=nothumbnail></div>";
		if (post.media$thumbnail) {
			var thumbnail = "<a class=thumbnail href='" + link.href
					+ "'><img src='" + post.media$thumbnail.url + "'/></a>";
		}
		var shortText = "" + post.summary.$t;
		if (shortText.length > 77) {
			shortText = shortText.substring(0, 77);
			shortText = shortText.substring(0, shortText.lastIndexOf(" "))
					+ "...";
		}
		var href = link.href;
		href = href.replace("http://", "https://");
		var summary = "<a class=summary href='" + href + "'>" + shortText
				+ "</a>"
		var title = "<a class=posttitle href='" + href + "'>" + link.title
				+ "</a>";
		var publicationDate = formatDate(new Date(post.published.$t));

		var html = "<li class=latestpost>" + thumbnail + "<div class=text>"
				+ title + summary + publicationDate + "</div></li>";
		s += html;
	}
	var toc = $("ggLatestPosts").html(s);
})};

loadLatestPosts();
