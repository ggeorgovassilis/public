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
		waitForJquery(function() {
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
			var z = $('<div><div>');
			toc.append(z);
			var toBeTOCced = $('#main article h1,h2,h3,h4,h5');
			if (toBeTOCced.length < 2)
				return false;

			for (var i = 0; i < toBeTOCced.length; i++) {
				var headerId = toBeTOCced[i].id || 'link' + i;
				var li = $("<li><a class='toclink h" + toBeTOCced[i].nodeName
						+ "' href='#" + headerId + "'>" + htmlEncode(toBeTOCced[i].innerText)
						+ "'></a></li>");
				z.append(li);
			}
			return toc;
		});
	}

	function showTOC() {
		window.setTimeout(createTOC, 1);
	}

	loadCss("//cdnjs.cloudflare.com/ajax/libs/highlight.js/9.9.0/styles/default.min.css");
	loadCss("https://fonts.googleapis.com/css?family=Pangolin|Lato|Monserrat");
	applySyntaxHighlighting();
	rewriteLinksToHttps();
	showTOC();
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
	var entries = v.feed.entry;
	var count = entries.length < 5 ? entries.length : 5;
	var e = document.getElementById("ggLatestPosts");
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
	e.innerHTML = s;
}

loadLatestPosts();
