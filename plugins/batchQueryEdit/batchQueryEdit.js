(function() {
    let pluginName = "batchQueryEdit";
    let running = false;
    const buttons = [];
    let maxCount = 0;

    function run(videoExtensions) {
        if (!running) return;
        const button = buttons.pop();
        stash.setProgress((maxCount - buttons.length) / maxCount * 100);
        if (button) {
            const searchItem = getClosestAncestor(button, '.search-item');
            const {
                data,
                queryInput,
            } = stash.parseSearchItem(searchItem);

            const form = document.getElementById('query-edit-config');
            const {
                includeStudio,
                includeDate,
                includePerformers,
                includeTitle,
                includeMovie,
                includeSceneIndex,
                applyBlacklist,
                useStashID,
            } = Object.fromEntries(new FormData(form).entries());

            const videoExtensionRegexes = videoExtensions.map(s => [new RegExp(`.${s}$`, "gi"), '']);
            const blacklist = [];
            if (applyBlacklist) {
                const blacklistTags = getElementsByXpath("//div[@class='tagger-container-header']//h5[text()='Blacklist']/following-sibling::span/text()")
                let node = null;
                while (node = blacklistTags.iterateNext()) {
                    blacklist.push([new RegExp(node.nodeValue, "gi"), '']);
                }
                blacklist.push([/[_-]/gi, ' ']);
                blacklist.push([/[^a-z0-9\s]/gi, '']);
                if (data.date) {
                    blacklist.push([new RegExp(data.date.replaceAll('-', ''), "gi"), '']);
                }
            }

            const filterBlacklist = (s, regexes) => regexes.reduce((acc, [regex, repl]) => {
                return acc.replace(regex, repl);
            }, s)

            const queryData = [];
            const stashId = data.stash_ids[0]?.stash_id;
            if (useStashID && stashId) {
                queryData.push(stashId);
            }
            else {
                if (data.date && includeDate) queryData.push(data.date);
                if (data.studio && includeStudio) queryData.push(filterBlacklist(data.studio.name, blacklist));
                if (data.performers && includePerformers !== 'none') {
                    for (const performer of data.performers) {
                        if (includePerformers === 'all' || (includePerformers === 'female-only' && performer.gender.toUpperCase() === 'FEMALE')) {
                            queryData.push(filterBlacklist(performer.name, blacklist));
                        }
                    }
                }
                if (data.title && includeTitle) queryData.push(filterBlacklist(data.title, videoExtensionRegexes.concat(blacklist)));
                if (data.movies && data.movies[0] && includeMovie) queryData.push(filterBlacklist(data.movies[0].movie.name, blacklist));
                if (data.movies && data.movies[0] && includeSceneIndex) queryData.push(filterBlacklist("Scene "+ data.movies[0].scene_index, blacklist));
            }

            const queryValue = queryData.join(' ');
            updateTextInput(queryInput, queryValue);

            setTimeout(() => run(videoExtensions), 50);
        }
        else {
            stop();
        }
    }

    const queryEditConfigId = 'query-edit-config';
    const btnId = 'batch-query-edit';
    const startLabel = 'Query Edit All';
    const stopLabel = 'Stop Query Edit';
    const btn = document.createElement("button");
    btn.setAttribute("id", btnId);
    btn.classList.add('btn', 'btn-primary', 'ml-3');
    btn.innerHTML = startLabel;
    btn.onclick = () => {
        if (running) {
            stop();
        }
        else {
            start();
        }
    };

    function start() {
        btn.innerHTML = stopLabel;
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-danger');
        running = true;
        stash.setProgress(0);
        buttons.length = 0;
        for (const button of document.querySelectorAll('.btn.btn-primary')) {
            if (button.innerText === 'Search') {
                buttons.push(button);
            }
        }
        maxCount = buttons.length;
        const reqData = {
            "variables": {},
            "query": `query Configuration {
                configuration {
                  general {
                    videoExtensions
                  }
                }
              }`
        }
        stash.callGQL(reqData).then(data => {
            run(data.data.configuration.general.videoExtensions);
        });
    }

    function stop() {
        btn.innerHTML = startLabel;
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-primary');
        running = false;
        stash.setProgress(0);
    }

    stash.addEventListener('tagger:mutations:header', evt => {
        const el = getElementByXpath("//button[text()='Scrape All']");
        if (el && !document.getElementById(btnId)) {
            const container = el.parentElement;
            container.appendChild(btn);
            sortElementChildren(container);
            el.classList.add('ml-3');
        }
    });

    stash.addEventListener('tagger:configuration', evt => {
        const el = evt.detail;
        if (!document.getElementById(queryEditConfigId)) {
            const configContainer = el.parentElement;
            const queryEditConfig = createElementFromHTML(`
<form id="${queryEditConfigId}" class="col-md-6 mt-4">
<h5>Query Edit Configuration</h5>
<div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="includeDate" class="form-check-input">
            <label title="" for="includeDate" class="form-check-label">Include Date</label>
        </div>
        <small class="form-text">Toggle whether date is included in query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="includeStudio" class="form-check-input">
            <label title="" for="includeStudio" class="form-check-label">Include Studio</label>
        </div>
        <small class="form-text">Toggle whether studio is included in query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="radio" name="includePerformers" value="all" class="form-check-input">
            <label title="" for="includePerformers-all" class="form-check-label mr-4">Include All Performers</label>
            <input type="radio" name="includePerformers" value="female-only" class="form-check-input">
            <label title="" for="includePerformers-female-only" class="form-check-label mr-4">Female Only</label>
            <input type="radio" name="includePerformers" value="none" class="form-check-input">
            <label title="" for="includePerformers-none" class="form-check-label">No Performers</label>
        </div>
        <small class="form-text">Toggle whether performers are included in query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="includeTitle" class="form-check-input">
            <label title="" for="includeTitle" class="form-check-label">Include Title</label>
        </div>
        <small class="form-text">Toggle whether title is included in query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="includeMovie" class="form-check-input">
            <label title="" for="includeMovie" class="form-check-label">Include Movie</label>
        </div>
        <small class="form-text">Toggle whether movie name is included in query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="includeSceneIndex" class="form-check-input">
            <label title="" for="includeSceneIndex" class="form-check-label">Include Scene Index</label>
        </div>
        <small class="form-text">Toggle whether movie scene index is included in query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="applyBlacklist" class="form-check-input">
            <label title="" for="applyBlacklist" class="form-check-label">Apply Blacklist</label>
        </div>
        <small class="form-text">Toggle whether blacklist is applied to query.</small>
    </div>
    <div class="align-items-center form-group">
        <div class="form-check">
            <input type="checkbox" name="useStashID" class="form-check-input">
            <label title="" for="useStashID" class="form-check-label">Use StashID</label>
        </div>
        <small class="form-text">Toggle whether query is set to StashID if scene has one.</small>
    </div>
</div>
</div>
            `);
            configContainer.appendChild(queryEditConfig);
            loadSettings();
        }
    });

    async function loadSettings() {
        const form = document.getElementById('query-edit-config');
        const values = await stash.getPluginSettings(pluginName) || {
            "includeDate": "on",
            "includeStudio": "on",
            "includePerformers": "all",
            "includeTitle": "on",
            "applyBlacklist": "on",
        };
        for (const [ key, value ] of Object.entries(values) ) {
            const field = form.elements.namedItem(key);
            if(field) {
                field.value = field.checked = value;
            }
        }
        form.addEventListener('change', async () => {
            const values = Object.fromEntries(new FormData(form).entries());
            await stash.setPluginSettings(pluginName, values);
        });
    }

})();
