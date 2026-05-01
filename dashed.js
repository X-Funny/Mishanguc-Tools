importPackage(Packages.com.sk89q.worldedit);
importPackage(Packages.com.sk89q.worldedit.math);
importPackage(Packages.com.sk89q.worldedit.blocks);

(function() { 
    var blocks = context.remember();
    var player = context.getPlayer();

    // 1. === 解析参数 ===
    var emptyLength = 3; // 默认空格长度
    var solidLength = 3; // 默认实线长度

    if (typeof argv !== 'undefined') {
        // 解析第一个参数：空格长
        if (argv[1] !== undefined) {
            var parsedEmpty = parseInt(argv[1]);
            if (isNaN(parsedEmpty) || parsedEmpty <= 0) {
                player.printError("第一个参数(空格长)无效！必须是大于0的数字。");
                return; 
            }
            emptyLength = parsedEmpty;
        }
        
        // 解析第二个参数：实线长
        if (argv[2] !== undefined) {
            var parsedSolid = parseInt(argv[2]);
            if (isNaN(parsedSolid) || parsedSolid <= 0) {
                player.printError("第二个参数(实线长)无效！必须是大于0的数字。");
                return; 
            }
            solidLength = parsedSolid;
        }
    }

    player.print("当前虚线配置：替换 " + emptyLength + " 格空格，保留 " + solidLength + " 格实线。");

    // 计算一个完整的虚线周期
    var cycleLength = solidLength + emptyLength;


    // 2. === 获取起点状态 ===
    var startPos = player.getBlockOn().toVector().toBlockPoint();
    var startBlock = blocks.getBlock(startPos);

    if (!startBlock) {
        player.printError("未检测到脚下的方块");
        return;
    }

    var startBlockName = String(startBlock).split("[")[0];

    // 定义标线“家族”
    var lineFamilies = [
        ["mishanguc:road_with_white_line", "mishanguc:road_with_white_ba_line"],
        ["mishanguc:road_with_white_thick_line", "mishanguc:road_with_white_ba_thick_line"],
        ["mishanguc:road_with_yellow_line", "mishanguc:road_with_yellow_ba_line"],
        ["mishanguc:road_with_yellow_double_line", "mishanguc:road_with_yellow_ba_double_line"],
        ["mishanguc:road_with_white_offset_line", "mishanguc:road_with_white_offset_out_ba_line", "mishanguc:road_with_white_offset_in_ba_line"],
        ["mishanguc:road_with_yellow_offset_line", "mishanguc:road_with_yellow_offset_out_ba_line", "mishanguc:road_with_yellow_offset_in_ba_line"]
    ];

    var targetFamily = null;
    for (var i = 0; i < lineFamilies.length; i++) {
        if (lineFamilies[i].indexOf(startBlockName) !== -1) {
            targetFamily = lineFamilies[i];
            break;
        }
    }

    if (!targetFamily) {
        player.printError("脚下的方块不是支持的标线类型，请站在正确的标线上！");
        return;
    }

    // --- 内部辅助函数 ---
    function isSameFamily(pos) {
        var b = blocks.getBlock(pos);
        if (!b) return false;
        var bName = String(b).split("[")[0];
        return targetFamily.indexOf(bName) !== -1;
    }

    function isLineEndPoint(pos) {
        var directions = [
            BlockVector3.at(1, 0, 0), BlockVector3.at(-1, 0, 0),
            BlockVector3.at(0, 0, 1), BlockVector3.at(0, 0, -1),
            BlockVector3.at(1, 0, 1), BlockVector3.at(1, 0, -1),
            BlockVector3.at(-1, 0, 1), BlockVector3.at(-1, 0, -1),
            BlockVector3.at(1, 1, 0), BlockVector3.at(-1, 1, 0),
            BlockVector3.at(0, 1, 1), BlockVector3.at(0, 1, -1),
            BlockVector3.at(1, -1, 0), BlockVector3.at(-1, -1, 0),
            BlockVector3.at(0, -1, 1), BlockVector3.at(0, -1, -1)
        ];

        var connectedCount = 0;
        for (var i = 0; i < directions.length; i++) {
            if (isSameFamily(pos.add(directions[i]))) {
                connectedCount++;
            }
        }
        return connectedCount <= 1;
    }

    function getLinePath(origin, maxDist) {
        var path = [];
        var visited = {};
        var currentPos = origin;

        var dirs = [
            BlockVector3.at(1, 0, 0), BlockVector3.at(-1, 0, 0),
            BlockVector3.at(0, 0, 1), BlockVector3.at(0, 0, -1),
            BlockVector3.at(1, 0, 1), BlockVector3.at(1, 0, -1),
            BlockVector3.at(-1, 0, 1), BlockVector3.at(-1, 0, -1),
            BlockVector3.at(0, 1, 0), BlockVector3.at(0, -1, 0),
            BlockVector3.at(1, 1, 0), BlockVector3.at(-1, 1, 0),
            BlockVector3.at(0, 1, 1), BlockVector3.at(0, 1, -1),
            BlockVector3.at(1, -1, 0), BlockVector3.at(-1, -1, 0),
            BlockVector3.at(0, -1, 1), BlockVector3.at(0, -1, -1)
        ];

        for (var i = 0; i < maxDist; i++) {
            path.push(currentPos);
            visited[String(currentPos)] = true;

            var nextPos = null;
            for (var d = 0; d < dirs.length; d++) {
                var candidate = currentPos.add(dirs[d]);
                if (!visited[String(candidate)] && isSameFamily(candidate)) {
                    nextPos = candidate;
                    break; 
                }
            }
            if (!nextPos) break; 
            currentPos = nextPos;
        }
        return path;
    }

    // 3. === 主逻辑 ===
    if (!isLineEndPoint(startPos)) {
        player.printError("请站在实线的端点上运行此脚本！");
    } else {
        var path = getLinePath(startPos, 10000);
        var roadBlock = context.getBlock("mishanguc:road_block");
        var replacedCount = 0;

        if (roadBlock) {
            for (var i = 0; i < path.length; i++) {
                if (i % cycleLength >= solidLength) {
                    blocks.setBlock(path[i], roadBlock);
                    replacedCount++;
                }
            }
            player.print("虚线化完成！总长度: " + path.length + " 格，替换了 " + replacedCount + " 个空白路面方块。");
        } else {
            player.printError("无法找到替换的方块: mishanguc:road_block");
        }
    }
})(); // 立即执行